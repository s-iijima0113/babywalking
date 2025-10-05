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

// CSV_赤ちゃんトイレ・授乳室を読み込む関数
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
		lat, lng, err := geocoding.GeocodeAddress(record[12])
		if err != nil {
			// エラーハンドリング
			continue
		}

		// float64 → string に変換
		latStr := strconv.FormatFloat(lat, 'f', 6, 64)
		lngStr := strconv.FormatFloat(lng, 'f', 6, 64)
		//fmt.Println(latStr, lngStr)

		//必要な列のみ追加
		//Todo特徴追加
		edited = append(edited, []string{
			record[0],  //名称
			record[3],  //赤ちゃんトイレ
			record[4],  //授乳室
			record[6],  //設備内容
			record[9],  //特徴
			record[10], //郵便番号
			record[12], //住所
			record[13], //電話番号
			record[16], //営業時間
			record[17], //定休日
			record[18], //URL
			latStr,     //経緯
			lngStr,     //緯度
		})
	}
	return edited
}

// CSV_カフェを読み込む関数
func ReadCSV_Cafe(filePath string) ([][]string, error) {
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

	return records, nil
}

func EditCSV_Cafe(records [][]string) [][]string {

	// ここで必要な加工を行う
	edited := [][]string{}
	//recordsの1行目はヘッダーなのでスキップ
	for i, record := range records {
		if i == 0 {
			continue
		}
		//5列目の住所を経緯度に変換
		lat, lng, err := geocoding.GeocodeAddress(record[5])
		if err != nil {
			// エラーハンドリング
			continue
		}
		// float64 → string に変換
		latStr := strconv.FormatFloat(lat, 'f', 6, 64)
		lngStr := strconv.FormatFloat(lng, 'f', 6, 64)
		//fmt.Println(latStr, lngStr)
		edited = append(edited, []string{
			record[2],  //名称
			record[3],  //郵便番号
			record[5],  //住所
			record[6],  //電話番号
			record[9],  //営業時間
			record[10], //定休日
			record[11], //URL
			record[0],  //特典内容
			latStr,     //経緯
			lngStr,     //緯度
		})
	}
	return edited
}

// CSV_さいコイン、たまポンを読み込む関数
func ReadCSV_Coin(filePath string) ([][]string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	// Shift_JISエンコーディングのCSVを読み込む
	reader := csv.NewReader(file)

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

func EditCSV_Coin(records [][]string) [][]string {

	// ここで必要な加工を行う
	edited := [][]string{}

	//recordsの1行目はヘッダーなのでスキップ
	for i, record := range records {
		if i == 0 {
			continue
		}

		//5列目の住所を経緯度に変換
		lat, lng, err := geocoding.GeocodeAddress(record[4])
		if err != nil {
			// エラーハンドリング
			continue
		}

		// float64 → string に変換
		latStr := strconv.FormatFloat(lat, 'f', 6, 64)
		lngStr := strconv.FormatFloat(lng, 'f', 6, 64)
		//fmt.Println(latStr, lngStr)

		edited = append(edited, []string{
			record[0], //名称
			record[1], //業種
			record[2], //サービス
			record[3], //郵便番号
			record[4], //住所
			record[5], //電話番号
			latStr,    //経緯
			lngStr,    //緯度
		})
	}
	return edited
}
