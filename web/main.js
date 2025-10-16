mapboxgl.accessToken = 'pk.eyJ1Ijoic2F0b21paWkiLCJhIjoiY21kemViendyMGIzdzJrb2ltODFqZzdiZCJ9.oida2Ztmk9t7Gu7JQt1Qsw';

let map;
let directionsControl;
let mapLoaded = false;
let fallbackDestinationMarker;

//facilitiedAPI取得
let facilities = [];
let coins = [];
let markers = [];

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

function interpretBoolean(value) {
    if (Array.isArray(value)) {
        return value.some(interpretBoolean);
    }
    if (typeof value === 'boolean') {
        return value;
    }
    if (value === null || value === undefined) {
        return false;
    }
    const normalized = String(value).toLowerCase();
    return normalized.includes('true') || normalized === '1' || normalized === 'yes';
}

function matchesFacilityPreference(facility, preference) {
    if (!facility) return false;
    switch (preference) {
        case 'toilet':
            return interpretBoolean(facility.toilet);
        case 'nursing':
            return interpretBoolean(facility.nursing);
        default:
            return false;
    }
}

function matchesCoinPreference(coin, preference) {
    if (!coin || !coin.cointype) return false;
    if (preference === 'saicoin') {
        return coin.cointype.includes('さいコイン') || coin.cointype.toLowerCase().includes('saicoin');
    }
    if (preference === 'tamapon') {
        return coin.cointype.includes('たまポン') || coin.cointype.toLowerCase().includes('tamapon');
    }
    return false;
}

function findDestination(formData) {
    const facilityPreferences = formData.getAll('facility');
    const facilityTargets = facilityPreferences.filter(pref => pref === 'toilet' || pref === 'nursing');
    const coinTargets = facilityPreferences.filter(pref => pref === 'saicoin' || pref === 'tamapon');

    if (facilityTargets.length) {
        const matchedFacility = facilities.find(facility =>
            facilityTargets.some(pref => matchesFacilityPreference(facility, pref))
        );
        if (matchedFacility) {
            return { type: 'facility', data: matchedFacility };
        }
    }

    if (coinTargets.length) {
        const matchedCoin = coins.find(coin =>
            coinTargets.some(pref => matchesCoinPreference(coin, pref))
        );
        if (matchedCoin) {
            return { type: 'coin', data: matchedCoin };
        }
    }

    if (facilities.length) {
        return { type: 'facility', data: facilities[0] };
    }
    if (coins.length) {
        return { type: 'coin', data: coins[0] };
    }
    return null;
}

function clearFallbackMarker() {
    if (fallbackDestinationMarker) {
        fallbackDestinationMarker.remove();
        fallbackDestinationMarker = null;
    }
}

function handleFormSubmit(event) {
    event.preventDefault();

    if (!mapLoaded) {
        updateRouteMessage('地図を準備しています。少し待ってから再度お試しください。', true);
        return;
    }

    const formData = new FormData(event.target);
    const destinationResult = findDestination(formData);

    if (!destinationResult) {
        updateRouteMessage('表示できるルートが見つかりませんでした。', true);
        return;
    }

    const { type, data } = destinationResult;
    const lng = Number(data.lng);
    const lat = Number(data.lat);

    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        updateRouteMessage('目的地の位置情報を取得できませんでした。', true);
        return;
    }

    const label = type === 'coin' ? data.name : data.name || 'スポット';

    const origin = map.getCenter();
    const canUseDirections = directionsControl &&
        typeof directionsControl.setOrigin === 'function' &&
        typeof directionsControl.setDestination === 'function';

    if (canUseDirections) {
        directionsControl.setOrigin([origin.lng, origin.lat]);
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

    map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 15) });
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

    if (typeof MapboxDirections === 'function') {
        directionsControl = new MapboxDirections({
            accessToken: mapboxgl.accessToken,
            unit: 'metric',
            profile: 'mapbox/walking',
            alternatives: false,
            controls: {
                inputs: false,
                instructions: false
            },
            language: 'ja'
        });
        map.addControl(new MapboxLanguage({ defaultLanguage: 'ja' }));
    } else {
        directionsControl = null;
        console.warn('MapboxDirections が読み込めなかったため、ルート表示をマーカーに切り替えます。');
    }

    map.on('load', () => {
        mapLoaded = true;
        try {
            map.addControl(new MapboxLanguage({ defaultLanguage: 'ja' }));
        } catch (error) {
            console.warn('MapboxLanguage の読み込みに失敗しました。', error);
        }
        if (directionsControl) {
            try {
                map.addControl(directionsControl, 'top-right');
            } catch (error) {
                console.warn('MapboxDirections のコントロール追加に失敗しました。', error);
                directionsControl = null;
            }
        }
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


