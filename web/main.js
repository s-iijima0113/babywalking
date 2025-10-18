mapboxgl.accessToken = 'pk.eyJ1Ijoic2F0b21paWkiLCJhIjoiY21kemViendyMGIzdzJrb2ltODFqZzdiZCJ9.oida2Ztmk9t7Gu7JQt1Qsw';

const WALKING_SPEED_METERS_PER_MIN = 70;
const DEFAULT_ROUTE_RATIO = 1.35;
const ELLIPSE_POINTS = 120;
const EMPTY_ROUTE = {
    type: 'FeatureCollection',
    features: []
};

const FEEL_SPOTS = [
    {
        id: 'spot-keyaki-hiroba',
        name: 'けやきひろば',
        feel: ['meet-up', 'shopping'],
        lng: 139.6339,
        lat: 35.8936,
        description: 'イベントやマルシェが開かれる開放的な広場。'
    },
    {
        id: 'spot-omiya-park',
        name: '大宮公園',
        feel: ['nature', 'meet-up'],
        lng: 139.6336,
        lat: 35.9084,
        description: '木陰が気持ちいい自然豊かな定番スポット。'
    },
    {
        id: 'spot-cocoon',
        name: 'コクーンシティ',
        feel: ['shopping', 'meet-up'],
        lng: 139.6339,
        lat: 35.9004,
        description: 'ランチやショッピングを楽しめる大型商業施設。'
    },
    {
        id: 'spot-roastery',
        name: 'Roastery Saitama',
        feel: ['cafe', 'meet-up'],
        lng: 139.6478,
        lat: 35.8619,
        description: '自家焙煎コーヒーが人気の落ち着いたカフェ。'
    },
    {
        id: 'spot-bonheur',
        name: 'Cafe Bonheur',
        feel: ['cafe'],
        lng: 139.6474,
        lat: 35.8721,
        description: 'ベビーカーでも入りやすいスイーツカフェ。'
    },
    {
        id: 'spot-minuma',
        name: '見沼たんぼ遊歩道',
        feel: ['nature'],
        lng: 139.6805,
        lat: 35.9051,
        description: 'のんびり歩ける水辺の散策コース。'
    }
];

let map;
let mapLoaded = false;
let fallbackDestinationMarker;
let defaultOrigin;

//facilitiedAPI取得
let facilities = [];
let coins = [];
let markers = [];
let feelMarkers = [];
let startMarker = null;

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

    const walkingTimeMinutes = Number(formData.get('walkTime')) || 0;
    if (!Number.isFinite(walkingTimeMinutes) || walkingTimeMinutes <= 0) {
        updateRouteMessage('Walking time を選択してください。', true);
        return;
    }

    const matchingFeelSpots = FEEL_SPOTS.filter(spot =>
        spot.feel.some(feel => selectedFeels.includes(feel))
    );

    if (!matchingFeelSpots.length) {
        updateRouteMessage('選択した Feel に該当するスポットが見つかりませんでした。', true);
        clearFeelMarkers();
        clearRouteLine();
        clearStartMarker();
        return;
    }

    updateFeelMarkers(matchingFeelSpots);

    const center = calculateCenter(matchingFeelSpots);
    drawStartMarker(center);

    const totalMeters = walkingTimeMinutes * WALKING_SPEED_METERS_PER_MIN;
    const routeCoordinates = buildEllipseRoute(center, totalMeters, matchingFeelSpots);
    if (!routeCoordinates.length) {
        updateRouteMessage('ルートを描画できませんでした。別の条件をお試しください。', true);
        clearRouteLine();
        clearStartMarker();
        return;
    }

    updateRouteLine(routeCoordinates);
    adjustCamera(routeCoordinates, matchingFeelSpots);

    const feelSummary = new Intl.ListFormat('ja', { style: 'short', type: 'conjunction' })
        .format([...new Set(matchingFeelSpots.flatMap(spot => spot.feel.filter(f => selectedFeels.includes(f))))]);
    updateRouteMessage(`${feelSummary} の気分に合わせて約 ${walkingTimeMinutes} 分のお散歩ルートを描画しました。`);
}

function clearFeelMarkers() {
    feelMarkers.forEach(marker => marker.remove());
    feelMarkers = [];
}

function clearStartMarker() {
    if (startMarker) {
        startMarker.remove();
        startMarker = null;
    }
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

function calculateCenter(spots) {
    if (!spots.length) {
        const center = map.getCenter();
        return { lng: center.lng, lat: center.lat };
    }
    const totals = spots.reduce((acc, spot) => {
        acc.lng += spot.lng;
        acc.lat += spot.lat;
        return acc;
    }, { lng: 0, lat: 0 });
    return {
        lng: totals.lng / spots.length,
        lat: totals.lat / spots.length
    };
}

function drawStartMarker(center) {
    if (!map) {
        return;
    }
    if (startMarker) {
        startMarker.remove();
    }
    startMarker = new mapboxgl.Marker({ color: '#ff6b6b' })
        .setLngLat([center.lng, center.lat])
        .setPopup(new mapboxgl.Popup({ offset: 12 }).setHTML('<strong>スタート & ゴール</strong>'))
        .addTo(map);
}

function metersPerDegreeLatitude() {
    return 111320;
}

function metersPerDegreeLongitude(latitude) {
    const latRad = latitude * Math.PI / 180;
    const meters = 111320 * Math.cos(latRad);
    return Math.max(meters, 1); // 回転計算時のゼロ割防止
}

function buildEllipseRoute(center, totalMeters, anchorSpots) {
    if (!Number.isFinite(totalMeters) || totalMeters <= 0) {
        return [];
    }

    const axes = deriveEllipseAxes(totalMeters);
    if (axes.a <= 0 || axes.b <= 0) {
        return [];
    }

    const orientation = computeOrientation(center, anchorSpots);
    const cos = Math.cos(orientation);
    const sin = Math.sin(orientation);
    const latMeters = metersPerDegreeLatitude();
    const lngMeters = metersPerDegreeLongitude(center.lat);

    const coordinates = [];
    for (let i = 0; i <= ELLIPSE_POINTS; i++) {
        const theta = (i / ELLIPSE_POINTS) * Math.PI * 2;
        const x = axes.a * Math.cos(theta);
        const y = axes.b * Math.sin(theta);
        const rotatedX = x * cos - y * sin;
        const rotatedY = x * sin + y * cos;

        const lng = center.lng + (rotatedX / lngMeters);
        const lat = center.lat + (rotatedY / latMeters);
        coordinates.push([lng, lat]);
    }

    if (coordinates.length) {
        const first = coordinates[0];
        const last = coordinates[coordinates.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
            coordinates.push([first[0], first[1]]);
        }
    }

    return coordinates;
}

function deriveEllipseAxes(totalMeters) {
    const target = Math.max(totalMeters, 200);
    let a = target / (2 * Math.PI);
    for (let i = 0; i < 8; i++) {
        const b = a / DEFAULT_ROUTE_RATIO;
        const circumference = approximateEllipseCircumference(a, b);
        if (circumference === 0) {
            break;
        }
        const scale = target / circumference;
        a *= scale;
    }
    return { a, b: a / DEFAULT_ROUTE_RATIO };
}

function approximateEllipseCircumference(a, b) {
    const h = Math.pow((a - b) / (a + b), 2);
    return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
}

function computeOrientation(center, spots) {
    if (!spots.length) {
        return 0;
    }
    const lngMeters = metersPerDegreeLongitude(center.lat);
    const latMeters = metersPerDegreeLatitude();
    let sumX = 0;
    let sumY = 0;
    spots.forEach(spot => {
        sumX += (spot.lng - center.lng) * lngMeters;
        sumY += (spot.lat - center.lat) * latMeters;
    });
    if (Math.abs(sumX) < 1e-6 && Math.abs(sumY) < 1e-6) {
        return 0;
    }
    return Math.atan2(sumY, sumX);
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

    const label = type === 'coin' ? data.name : data.name || 'スポット';

    const currentOrigin = defaultOrigin || map.getCenter();
    const canUseDirections = directionsControl &&
        typeof directionsControl.setOrigin === 'function' &&
        typeof directionsControl.setDestination === 'function';

    if (canUseDirections) {
        directionsControl.setOrigin([currentOrigin.lng, currentOrigin.lat]);
        directionsControl.setDestination([lng, lat]);
        clearFallbackMarker();
        updateRouteMessage(`${label} までの徒歩ルートを表示しました。`);
    } else {
        clearFallbackMarker();
        fallbackDestinationMarker = new mapboxgl.Marker()
            .setLngLat([lng, lat])
            .addTo(map);
        updateRouteMessage(`${label} の位置を地図に表示しました。`);
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
        if (!defaultOrigin) {
            const center = map.getCenter();
            defaultOrigin = { lng: center.lng, lat: center.lat };
        }
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
});
