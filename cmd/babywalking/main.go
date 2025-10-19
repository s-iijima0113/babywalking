package main

import (
	"babywalking/internal/csv"
	"babywalking/internal/db"
	"fmt"
	"log"
	"net/http"
)

func main() {
	//fs := http.FileServer(http.Dir("../../web"))
	fs := http.FileServer(http.Dir("web"))
	//http.Handle("/static/", http.StripPrefix("/static/", fs))
	http.Handle("/", fs)

	//http.HandleFunc("/", handler)
	http.HandleFunc("/search", searchHandler)

	//DB接続
	db.InitDB()
	//アプリ終了時にDB切断
	defer db.DB.Close()

	// feel_spotsテーブル準備
	db.EnsureFeelSpotsTable()

	//facilitiesテーブルにデータが存在するかチェック
	//Todo バッチ処理にする
	var exists = db.CheckExists()
	if exists {
		fmt.Println("すでにデータが存在するのでINSERTはスキップします")
	} else {
		//CSV読み込み
		records, err := csv.ReadCSV("data/babyfacilities.csv")
		if err != nil {
			log.Fatalf("CSV読み込みエラー: %v", err)
		}

		// CSV編集
		edited := csv.EditCSV(records)
		//log.Printf("CSVレコード: %v", edited)

		//DB書き込み
		db.AddDb(edited)
	}
	// //FacilitiesAPI実行
	// db.FacilityAPI()

	//cafeテーブルにデータが存在するかチェック
	//Todo バッチ処理にする
	var exists_Cafe = db.CheckExists_Cafe()
	if exists_Cafe {
		fmt.Println("すでにカフェデータが存在するのでINSERTはスキップします")
	} else {
		//カフェCSV読み込み
		records, err := csv.ReadCSV_Cafe("data/cafe.csv")
		if err != nil {
			log.Fatalf("CSV読み込みエラー: %v", err)
		}

		// CSV編集
		edited := csv.EditCSV_Cafe(records)

		//DB書き込み
		db.AddDb_Cafe(edited)
	}

	//Coinテーブルにデータが存在するかチェック
	//Todo バッチ処理にする
	var exists_Coin = db.CheckExists_Coin()
	if exists_Coin {
		fmt.Println("すでにコインデータが存在するのでINSERTはスキップします")
	} else {
		//さいコイン、たまポンPDF読み込み
		records, err := csv.ReadCSV_Coin("data/shop.csv")

		if err != nil {
			log.Fatalf("CSV読み込みエラー: %v", err)
		}
		// CSV編集
		edited := csv.EditCSV_Coin(records)

		//DB書き込み
		db.AddDb_Coin(edited)
	}

	//FacilitiesAPI実行
	db.FacilityAPI()

	//CoinAPI実行
	db.CoinAPI()

	// FeelSpotAPI 実行
	db.FeelSpotAPI()

	// feel_spots のデータ投入
	db.SeedFeelSpots()

	log.Fatal(http.ListenAndServe(":8080", nil))

}

// func handler(w http.ResponseWriter, r *http.Request) {
// 	tmpl := template.Must(template.ParseFiles("web/index.html"))
// 	tmpl.Execute(w, nil)
// }

func searchHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POSTメソッドで送信してください", http.StatusMethodNotAllowed)
		return
	}

	err := r.ParseForm()
	if err != nil {
		http.Error(w, "フォームの解析に失敗しました", http.StatusBadRequest)
		return
	}

	r.ParseForm()

	var feelValues []string
	var facilityValues []string
	var time string
	var shade string

	feelValues = r.Form["feel"]
	facilityValues = r.Form["facility"]
	time = r.FormValue("walkTime")
	shade = r.FormValue("shade")

	log.Printf("受け取ったデータ: feel=%s, facility=%s, time=%s, shade=%s", feelValues, facilityValues, time, shade)

	//fmt.Fprintf(w, "検索条件を受け取りました!!!!!!")
	fmt.Fprintf(w, "検索条件を受け取りましたfeel=%s, facility=%s, time=%s, shade=%s", feelValues, facilityValues, time, shade)
}
