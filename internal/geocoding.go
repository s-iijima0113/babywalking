package geocoding

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
)

// type Coordinate struct {
// 	Lat float64
// 	Lon float64
// }

// JSONをマッピングする構造体
type Result struct {
	Geometry struct {
		Coordinates [2]float64 `json:"coordinates"`
	} `json:"geometry"`
}

// 国土地理院APIで住所を座標に変換する関数
func GeocodeAddress(address string) (lat, lon float64, err error) {
	//url := fmt.Sprintf("https://msearch.gsi.go.jp/address-search/AddressSearch?q=%s", address)
	baseURL := "https://msearch.gsi.go.jp/address-search/AddressSearch?q="
	encodedAddress := url.QueryEscape(address)
	fullURL := baseURL + encodedAddress

	resp, err := http.Get(fullURL)
	if err != nil {
		return 0, 0, fmt.Errorf("HTTP GET error: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, 0, fmt.Errorf("読み取りエラー: %w", err)
	}

	var results []Result
	err = json.Unmarshal(body, &results)
	if err != nil {
		return 0, 0, fmt.Errorf("JSON パースエラー: %w", err)
	}

	if len(results) == 0 {
		return 0, 0, fmt.Errorf("検索結果なし")
	}

	// 経度・緯度を取り出す
	lon = results[0].Geometry.Coordinates[0]
	lat = results[0].Geometry.Coordinates[1]
	return lat, lon, nil
}
