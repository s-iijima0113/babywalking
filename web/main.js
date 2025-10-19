mapboxgl.accessToken = 'pk.eyJ1Ijoic2F0b21paWkiLCJhIjoiY21kemViendyMGIzdzJrb2ltODFqZzdiZCJ9.oida2Ztmk9t7Gu7JQt1Qsw';

const WALKING_SPEED_METERS_PER_MIN = 70;
const MAX_RANDOM_FEEL_SPOTS = 3;
const MAX_ROUTE_ATTEMPTS = 12;
const START_COORDINATES = { lng: 139.647238, lat: 35.86236 };
const EMPTY_ROUTE = {
    type: 'FeatureCollection',
    features: []
};

let map;
let mapLoaded = false;

//facilitiedAPI取得
let facilities = [];
let coins = [];
let markers = [];
let feelMarkers = [];
let startMarker = null;
let feelSpots = [];
let lastRouteSignature = null;

let routeMessageElement;

function updateRouteMessage(message, isError = false) {
    if (!routeMessageElement) {
        return;
    }
    routeMessageElement.textContent = message;
    routeMessageElement.classList.toggle('route-message--error', Boolean(isError));
}

async function loadFacilities() {
    try {
        const [resFacilities, resCoins] = await Promise.all([
            fetch('/api/facilities'),
            fetch('/api/coins')
        ]);

        if (!resFacilities.ok) {
            throw new Error('facilities API error');
        }
        if (!resCoins.ok) {
            throw new Error('coins API error');
        }

        facilities = await resFacilities.json();
        coins = await resCoins.json();
        updateMarkers();
    } catch (error) {
        console.error('データの取得に失敗しました', error);
        updateRouteMessage('データの取得に失敗しました。時間をおいて再度お試しください。', true);
    }
}

async function loadFeelSpots() {
    try {
        const response = await fetch('/api/feel-spots');
        if (!response.ok) {
            throw new Error('feel-spots API error');
        }
        feelSpots = await response.json();
    } catch (error) {
        console.error('Feel スポットの取得に失敗しました', error);
        updateRouteMessage('スポット情報の取得に失敗しました。時間をおいて再度お試しください。', true);
    }
}

function updateMarkers() {
    if (!map) {
        return;
    }
    // 古いマーカー削除
    markers.forEach(m => m.remove());
    markers = [];

    const showToilet = isChecked('toilet');
    const showNursing = isChecked('nursing');
    const showSaicoin = isChecked('saicoin');
    const showTamapon = isChecked('tamapon');

    facilities.forEach(facility => {
        if (
            (facility.toilet.includes(true) && showToilet) ||
            (facility.nursing.includes(true) && showNursing)
        ) {
            const el = document.createElement('div');
            el.style.width = '30px';
            el.style.height = '30px';
            el.style.backgroundSize = 'cover';

            if (facility.toilet.includes(true) && facility.nursing.includes(true)) {
            // 両方持つ施設ならアイコンを横に並べる
            el.style.display = "flex";
            el.innerHTML = `
            <img src="./icon/toilet.png" style="width:15px;height:15px;">
            <img src="./icon/nursing.png" style="width:15px;height:15px;">
            `;
            } else if (facility.toilet.includes(true)) {
                el.style.backgroundImage = 'url(./icon/toilet.png)';
            } else if (facility.nursing.includes(true)) {
                el.style.backgroundImage = 'url(./icon/nursing.png)';
            }

            const popupContent = `
                <strong>${facility.name}</strong><br>
                Address: ${facility.address}<br>
                Postcode: ${facility.postcode}<br>
                Phone: ${facility.phone_number}<br>
                Opening Hours: ${facility.opening_hours}<br>
                Regular Holidays: ${facility.regular_holidays}<br>
                Website: <a href="${facility.website}" target="_blank">${facility.website}</a>
                `;
            
            const marker = new mapboxgl.Marker(el)
                .setLngLat([facility.lng, facility.lat])
                .setPopup(new mapboxgl.Popup().setHTML(popupContent))
                .addTo(map);

            markers.push(marker);
        }
    });

    // coin施設のマーカー追加
    coins.forEach(coin => {
        if (
            showSaicoin && coin.cointype.includes('さいコイン') ||
            (showTamapon && coin.cointype.includes('たまポン'))
        ) {
            const el = document.createElement('div');
            el.style.width = '30px';
            el.style.height = '30px';
            el.style.backgroundSize = 'cover';

            if (coin.cointype.includes('さいコイン') && coin.cointype.includes('たまポン')) {
                // 両方持つ施設ならアイコンを横に並べる
                el.style.display = "flex";
                el.innerHTML = `
            <img src="./icon/coin_green.png" style="width:15px;height:15px;">
            <img src="./icon/pint_green.png" style="width:15px;height:15px;">
            `;
            } else if (coin.cointype.includes('さいコイン')) {
                el.style.backgroundImage = 'url(./icon/coin_green.png)';
            } else if (coin.cointype.includes('たまポン')) {
                el.style.backgroundImage = 'url(./icon/pint_green.png)';
            }

            const popupContent = `
                <strong>${coin.name}</strong><br>
                category: ${coin.category}<br>
                Address: ${coin.address}<br>
                Postcode: ${coin.postcode}<br>
                Phone: ${coin.phone_number}<br>
                `;

            const marker = new mapboxgl.Marker(el)
                .setLngLat([coin.lng, coin.lat])
                .setPopup(new mapboxgl.Popup().setHTML(popupContent))
                .addTo(map);

            markers.push(marker);
        }
    });
}

function isChecked(id) {
    const element = document.getElementById(id);
    return Boolean(element && element.checked);
}

function handleFormSubmit(event) {
    event.preventDefault();

    if (!mapLoaded) {
        updateRouteMessage('地図を準備しています。少し待ってから再度お試しください。', true);
        return;
    }

    const formData = new FormData(event.target);
    const selectedFeels = formData.getAll('feel');
    if (!selectedFeels.length) {
        updateRouteMessage('Feel の項目を1つ以上選択してください。', true);
        return;
    }

    if (!feelSpots.length) {
        updateRouteMessage('スポット情報を読み込めませんでした。ページを再読み込みしてお試しください。', true);
        drawStartMarker(START_COORDINATES);
        return;
    }

    const walkingTimeMinutes = Number(formData.get('walkTime')) || 0;
    if (!Number.isFinite(walkingTimeMinutes) || walkingTimeMinutes <= 0) {
        updateRouteMessage('Walking time を選択してください。', true);
        return;
    }

    const matchingFeelSpots = feelSpots.filter(spot =>
        spot.feel.some(feel => selectedFeels.includes(feel))
    );

    if (!matchingFeelSpots.length) {
        updateRouteMessage('選択した Feel に該当するスポットが見つかりませんでした。', true);
        clearFeelMarkers();
        clearRouteLine();
        drawStartMarker(START_COORDINATES);
        lastRouteSignature = null;
        return;
    }

    const totalMeters = walkingTimeMinutes * WALKING_SPEED_METERS_PER_MIN;
    const routePlan = planRandomRoute(START_COORDINATES, matchingFeelSpots, totalMeters, lastRouteSignature);

    if (!routePlan.coordinates.length || !routePlan.spots.length) {
        updateRouteMessage('条件に合うルートを描画できませんでした。別の条件をお試しください。', true);
        clearFeelMarkers();
        clearRouteLine();
        drawStartMarker(START_COORDINATES);
        lastRouteSignature = null;
        return;
    }

    updateFeelMarkers(routePlan.spots);
    drawStartMarker(START_COORDINATES);
    updateRouteLine(routePlan.coordinates);
    adjustCamera(routePlan.coordinates, routePlan.spots);
    lastRouteSignature = computeRouteSignature(routePlan);

    const feelSummary = new Intl.ListFormat('ja', { style: 'short', type: 'conjunction' })
        .format([...new Set(matchingFeelSpots.flatMap(spot => spot.feel.filter(f => selectedFeels.includes(f))))]);
    const spotSummary = new Intl.ListFormat('ja', { style: 'short', type: 'conjunction' })
        .format(routePlan.spots.map(spot => spot.name));
    updateRouteMessage(`${feelSummary} の気分に合わせて約 ${walkingTimeMinutes} 分で ${spotSummary} を巡るお散歩ルートを描画しました。`);
}

function clearFeelMarkers() {
    feelMarkers.forEach(marker => marker.remove());
    feelMarkers = [];
}

function updateFeelMarkers(spots) {
    if (!map) {
        return;
    }
    clearFeelMarkers();

    spots.forEach(spot => {
        const marker = new mapboxgl.Marker({ color: '#2d8cf0' })
            .setLngLat([spot.lng, spot.lat])
            .setPopup(new mapboxgl.Popup({ offset: 12 }).setHTML(`
                <strong>${spot.name}</strong><br>
                ${spot.description}
            `))
            .addTo(map);
        feelMarkers.push(marker);
    });
}

function drawStartMarker(position) {
    if (!map) {
        return;
    }
    if (startMarker) {
        startMarker.remove();
    }
    startMarker = new mapboxgl.Marker({ color: '#ff6b6b' })
        .setLngLat([position.lng, position.lat])
        .setPopup(new mapboxgl.Popup({ offset: 12 }).setHTML('<strong>スタート & ゴール</strong>'))
        .addTo(map);
}

function planRandomRoute(start, candidateSpots, totalMeters, previousSignature) {
    if (!Array.isArray(candidateSpots) || !candidateSpots.length) {
        return { coordinates: [], spots: [] };
    }

    let fallbackRoute = null;

    for (let attempt = 0; attempt < MAX_ROUTE_ATTEMPTS; attempt++) {
        const shuffled = shuffleArray(candidateSpots);
        const route = buildWalkingRoute(start, shuffled, totalMeters);
        if (!route.coordinates.length || !route.spots.length) {
            if (!fallbackRoute) {
                fallbackRoute = route;
            }
            continue;
        }

        const signature = computeRouteSignature(route);
        if (!signature || signature !== previousSignature) {
            return route;
        }

        if (!fallbackRoute) {
            fallbackRoute = route;
        }
    }

    return fallbackRoute || { coordinates: [], spots: [] };
}

function buildWalkingRoute(start, orderedCandidateSpots, totalMeters) {
    if (!Number.isFinite(totalMeters) || totalMeters <= 0) {
        return { coordinates: [], spots: [] };
    }

    const pathPoints = [{ lng: start.lng, lat: start.lat }];
    const selectedSpots = [];

    for (const spot of orderedCandidateSpots) {
        if (selectedSpots.length >= MAX_RANDOM_FEEL_SPOTS) {
            break;
        }
        const trialPoints = [...pathPoints, spot, start];
        const distance = computeRouteDistanceMeters(trialPoints);
        if (distance <= totalMeters) {
            selectedSpots.push(spot);
            pathPoints.push(spot);
        }
    }

    if (!selectedSpots.length) {
        const fallback = [...orderedCandidateSpots].sort((a, b) => {
            const distanceA = computeRouteDistanceMeters([start, a, start]);
            const distanceB = computeRouteDistanceMeters([start, b, start]);
            return distanceA - distanceB;
        });
        for (const spot of fallback) {
            const distance = computeRouteDistanceMeters([start, spot, start]);
            if (distance <= totalMeters) {
                return {
                    coordinates: densifyRouteCoordinates([start, spot, start]),
                    spots: [spot]
                };
            }
        }
        return { coordinates: [], spots: [] };
    }

    pathPoints.push({ lng: start.lng, lat: start.lat });
    return {
        coordinates: densifyRouteCoordinates(pathPoints),
        spots: selectedSpots
    };
}

function computeRouteDistanceMeters(points) {
    if (!Array.isArray(points) || points.length < 2) {
        return 0;
    }
    let total = 0;
    for (let i = 1; i < points.length; i++) {
        total += haversineDistanceMeters(points[i - 1], points[i]);
    }
    return total;
}

function haversineDistanceMeters(pointA, pointB) {
    if (!pointA || !pointB) {
        return 0;
    }
    const R = 6371000;
    const lat1 = toRadians(pointA.lat);
    const lat2 = toRadians(pointB.lat);
    const deltaLat = toRadians(pointB.lat - pointA.lat);
    const deltaLng = toRadians(pointB.lng - pointA.lng);

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) *
        Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRadians(degrees) {
    return degrees * Math.PI / 180;
}

function densifyRouteCoordinates(points) {
    if (!Array.isArray(points) || points.length < 2) {
        return [];
    }
    const coordinates = [];
    for (let i = 0; i < points.length - 1; i++) {
        const start = points[i];
        const end = points[i + 1];
        const segmentDistance = haversineDistanceMeters(start, end);
        const steps = Math.max(2, Math.ceil(segmentDistance / 60));
        for (let step = 0; step < steps; step++) {
            const t = steps === 1 ? 1 : step / (steps - 1);
            const lng = start.lng + (end.lng - start.lng) * t;
            const lat = start.lat + (end.lat - start.lat) * t;
            if (!coordinates.length || coordinates[coordinates.length - 1][0] !== lng || coordinates[coordinates.length - 1][1] !== lat) {
                coordinates.push([lng, lat]);
            }
        }
    }
    const last = points[points.length - 1];
    const lastCoord = coordinates[coordinates.length - 1];
    if (!lastCoord || lastCoord[0] !== last.lng || lastCoord[1] !== last.lat) {
        coordinates.push([last.lng, last.lat]);
    }
    return coordinates;
}

function shuffleArray(items) {
    const array = [...items];
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function computeRouteSignature(route) {
    if (!route || !Array.isArray(route.spots) || !route.spots.length) {
        return null;
    }
    return route.spots
        .map(spot => {
            if (spot && spot.id !== undefined && spot.id !== null) {
                return String(spot.id);
            }
            return spot && spot.name ? spot.name : '';
        })
        .join('>');
}

function updateRouteLine(coordinates) {
    if (!mapLoaded) {
        return;
    }
    const source = map.getSource('walk-route');
    if (source) {
        source.setData({
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates
                },
                properties: {}
            }]
        });
    }
}

function clearRouteLine() {
    if (!mapLoaded) {
        return;
    }
    const source = map.getSource('walk-route');
    if (source) {
        source.setData(EMPTY_ROUTE);
    }
}

function adjustCamera(routeCoordinates, spots) {
    if (!mapLoaded || !routeCoordinates.length) {
        return;
    }
    const allPoints = [...routeCoordinates, ...spots.map(spot => [spot.lng, spot.lat])];
    const validPoints = allPoints.filter(point =>
        Array.isArray(point) && point.length === 2 &&
        Number.isFinite(point[0]) && Number.isFinite(point[1])
    );
    if (!validPoints.length) {
        return;
    }
    const bounds = validPoints.reduce((acc, coord) => {
        if (!acc) {
            return new mapboxgl.LngLatBounds(coord, coord);
        }
        return acc.extend(coord);
    }, null);

    if (bounds) {
        map.fitBounds(bounds, { padding: 48, maxZoom: 16, duration: 1000 });
    }
}

// チェックボックスとフォームにイベント追加
document.addEventListener('DOMContentLoaded', () => {
    routeMessageElement = document.getElementById('route-message');

    map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [139.647238, 35.86236], //自宅
        zoom: 15
    });

    map.on('load', () => {
        mapLoaded = true;
        try {
            map.addControl(new MapboxLanguage({ defaultLanguage: 'ja' }));
        } catch (error) {
            console.warn('MapboxLanguage の読み込みに失敗しました。', error);
        }
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
        map.addSource('walk-route', {
            type: 'geojson',
            data: EMPTY_ROUTE
        });
        map.addLayer({
            id: 'walk-route-line',
            type: 'line',
            source: 'walk-route',
            layout: {
                'line-cap': 'round',
                'line-join': 'round'
            },
            paint: {
                'line-color': '#ff7f50',
                'line-width': 4,
                'line-opacity': 0.85
            }
        });
        drawStartMarker(START_COORDINATES);
        map.resize();
        
    });

    window.addEventListener('resize', () => {
        if (mapLoaded) {
            map.resize();
        }
    });

    updateRouteMessage('条件を選んで「送信」を押すと、お散歩ルートが地図に表示されます。');

    const checkboxIds = ['toilet', 'nursing', 'saicoin', 'tamapon'];
    checkboxIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', updateMarkers);
        }
    });

    const form = document.querySelector('form');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }

    loadFacilities();
    loadFeelSpots();
    map.addControl(new MapboxLanguage({ defaultLanguage: 'ja' }));
});
