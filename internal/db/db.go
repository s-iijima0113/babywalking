package db

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	_ "github.com/lib/pq" // PostgreSQL driver
)

// データの有無をチェック
func CheckExists() bool {
	dsn := "host=localhost port=5432 user=postgres password=password dbname=babywalking sslmode=disable"
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	var exists bool
	//データチェック
	err = db.QueryRow(`SELECT EXISTS (SELECT 1 FROM baby_facilities)`).Scan(&exists)
	if err != nil {
		log.Fatal(err)
	}
	return exists
}

// オープンデータ（赤ちゃんの駅）登録
func AddDb(edited [][]string) {
	dsn := "host=localhost port=5432 user=postgres password=password dbname=babywalking sslmode=disable"
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	// DBに接続できるか確認
	if err := db.Ping(); err != nil {
		log.Fatal(err)
	}
	fmt.Println("DBに接続しました")

	//DBにデータが存在するかチェック
	//Todo 後でバッチ処理にする
	//main.goに移動
	// var exists bool
	// err = db.QueryRow(`SELECT EXISTS (SELECT 1 FROM baby_facilities)`).Scan(&exists)
	// if err != nil {
	// 	log.Fatal(err)
	// }

	// if exists {
	// 	fmt.Println("すでにデータが存在するのでINSERTはスキップします")
	// 	return
	// }

	//SQL
	sql :=
		`INSERT INTO baby_facilities (toilet, nursing, name, address, lat, lon, geom, amenities, source, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, ST_SetSRID(ST_MakePoint($6, $5), 4326)::geography, $7, $8, $9)`

	//トランザクション開始
	tx, err := db.Begin()
	if err != nil {
		log.Fatal(err)
	}
	defer tx.Rollback()

	//Todo 暫定対応
	amenities := "{}"

	//データ挿入
	for _, s := range edited {

		//true/false変換
		toilet, err := strconv.ParseBool(s[1])
		if err != nil {
			log.Fatal(err)
		}

		nursing, err := strconv.ParseBool(s[2])
		if err != nil {
			log.Fatal(err)
		}

		//insert
		_, err = tx.Exec(sql,
			toilet,  //toilet $1
			nursing, //nursing $2
			s[0],    //name $3
			s[4],    //address $4
			s[5],    //lat $5
			s[6],    //lon $6
			//s[7],        //geom
			amenities,  //amenities
			"official", //source
			time.Now(), //updated_at
		)
		//fmt.Printf("%T %+v\n", s[1], s[1])
		//fmt.Printf("raw toilet=%q nursing=%q\n", toilet, nursing)
		//fmt.Printf("toilet=%T %v, nursing=%T %v\n", toilet, toilet, nursing, nursing)

		if err != nil {
			log.Fatal(err)
		}
	}

	//コミット
	if err := tx.Commit(); err != nil {
		log.Fatal(err)
	}
	fmt.Println("データを挿入しました")

}

// MapBoxに渡すAPI作成
type Facility struct {
	ID   int     `json:"id"`
	Type string  `json:"type"`
	Lat  float64 `json:"lat"`
	Lng  float64 `json:"lng"`
	Name string  `json:"name"`
}

func FacilityAPI() {
	// DB接続
	dsn := "host=localhost port=5432 user=postgres password=password dbname=babywalking sslmode=disable"
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	http.HandleFunc("/api/facilities", func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.Query("SELECT id, type, lat, lng, name FROM baby_facilities")
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var facilities []Facility
		for rows.Next() {
			var f Facility
			if err := rows.Scan(&f.ID, &f.Type, &f.Lat, &f.Lng, &f.Name); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			facilities = append(facilities, f)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(facilities)
	})

	log.Println("Server started at :8080")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
