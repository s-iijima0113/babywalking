mapboxgl.accessToken = 'pk.eyJ1Ijoic2F0b21paWkiLCJhIjoiY21kemViendyMGIzdzJrb2ltODFqZzdiZCJ9.oida2Ztmk9t7Gu7JQt1Qsw';
var map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v11',
    center: [139.647238, 35.86236], //自宅
    zoom: 15
});

//facilitiedAPI取得
let Facilities = [];
let coins = [];
let markers = [];


async function loadFacilities() {
    const resFacilities = await fetch('/api/facilities');
    facilities = await resFacilities.json();

    const resCoins = await fetch('/api/coins');
    coins = await resCoins.json();

    updateMarkers();
}

function updateMarkers() {
    // 古いマーカー削除
    markers.forEach(m => m.remove());
    markers = [];

    const showToilet = document.getElementById('toilet').checked;
    const showNursing = document.getElementById('nursing').checked;
    const showSaicoin = document.getElementById('saicoin').checked;
    const showTamapon = document.getElementById('tamapon').checked;

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

// チェックボックスにイベント追加
document.addEventListener("DOMContentLoaded", () => {
document.getElementById('toilet').addEventListener('change', updateMarkers);
document.getElementById('nursing').addEventListener('change', updateMarkers);
document.getElementById('saicoin').addEventListener('change', updateMarkers);
document.getElementById('tamapon').addEventListener('change', updateMarkers);
});
// 初回ロード
loadFacilities();


//地図の右上に案内表示
// map.addControl(
//     new MapboxDirections({
//         accessToken: mapboxgl.accessToken
//     }),
//     'top-left'
// );

// 言語設定を日本語に変更
map.addControl(new MapboxLanguage({ defaultLanguage: 'ja' }));
