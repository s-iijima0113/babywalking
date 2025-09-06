package csv

import (
	geocoding "babywalking/internal"
	"encoding/csv"
	"os"
	"strconv"
	"strings"

	"golang.org/x/text/encoding/japanese"
	"golang.org/x/text/transform"
)

// CSVを読み込む関数
func ReadCSV(filePath string) ([][]string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}

	defer file.Close()
	// Shift_JISエンコーディングのCSVを読み込む
	reader := csv.NewReader(transform.NewReader(file, japanese.ShiftJIS.NewDecoder()))

	//CSVを配列に格納
	records, err := reader.ReadAll()
	if err != nil {
		return nil, err
	}

	//全角スペースを半角スペースに置換
	for i := range records {
		for j := range records[i] {
			records[i][j] = strings.ReplaceAll(records[i][j], "\u3000", " ")
		}
	}

	return records, nil
}

func EditCSV(records [][]string) [][]string {

	// ここで必要な加工を行う
	edited := [][]string{}

	//recordsの1行目はヘッダーなのでスキップ
	for i, record := range records {
		if i == 0 {
			continue
		}
		//recordsの3行目が〇だったらtrueにする
		if record[3] != "○" {
			record[3] = "false"
		} else {
			record[3] = "true"
		}
		if record[4] != "○" {
			record[4] = "false"
		} else {
			record[4] = "true"
		}

		//12列目の住所を経緯度に変換
		// ここに処理を追加
		lat, lon, err := geocoding.GeocodeAddress(record[12])
		if err != nil {
			// エラーハンドリング
			continue
		}

		// float64 → string に変換
		latStr := strconv.FormatFloat(lat, 'f', 6, 64)
		lonStr := strconv.FormatFloat(lon, 'f', 6, 64)
		//fmt.Println(latStr, lonStr)

		//必要な列のみ追加
		//Todo特徴追加
		edited = append(edited, []string{
			record[0],  //名称
			record[3],  //赤ちゃんトイレ
			record[4],  //授乳室
			record[10], //郵便番号
			record[12], //住所
			latStr,     //経緯
			lonStr,     //緯度
			"amenity",  //Todo アメニティを取得したい
		})
	}
	return edited
}
