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

// facilitiesテーブルデータの有無をチェック
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

	//SQL
	sql := `INSERT INTO baby_facilities (name, toilet, nursing, others, features, postcode, address, lat, lng, geom, phone_number, opening_hours, regular_holidays, website, source, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, ST_SetSRID(ST_MakePoint($9, $8), 4326)::geography, $10, $11, $12, $13, $14, $15)`

	//トランザクション開始
	tx, err := db.Begin()
	if err != nil {
		log.Fatal(err)
	}
	defer tx.Rollback()

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
			s[0],       //name
			toilet,     //toilet
			nursing,    //nursing
			s[3],       //others
			s[4],       //features
			s[5],       //postCode
			s[6],       //address
			s[11],      //lat
			s[12],      //lng
			s[7],       //phone_number
			s[8],       //opening_hours
			s[9],       //regular_holidays
			s[10],      //website
			"official", //source
			time.Now(), //updated_at
		)

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

// coinテーブルデータの有無をチェック
func CheckExists_Coin() bool {
	dsn := "host=localhost port=5432 user=postgres password=password dbname=babywalking sslmode=disable"
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	var exists bool
	//データチェック
	err = db.QueryRow(`SELECT EXISTS (SELECT 1 FROM coins)`).Scan(&exists)
	if err != nil {
		log.Fatal(err)
	}
	return exists
}

// オープンデータ（さいコイン・たまポン）登録
func AddDb_Coin(edited [][]string) {
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

	//SQL
	sql := `INSERT INTO coins (name, category, cointype, postcode, address, lat, lng, geom, phone_number, source, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, ST_SetSRID(ST_MakePoint($7, $6), 4326)::geography, $8, $9, $10)`

	//トランザクション開始
	tx, err := db.Begin()
	if err != nil {
		log.Fatal(err)
	}
	defer tx.Rollback()

	//データ挿入
	for _, s := range edited {

		//insert
		_, err = tx.Exec(sql,
			s[0],       //name
			s[1],       //category
			s[2],       //cointype
			s[3],       //postcode
			s[4],       //address
			s[6],       //lat
			s[7],       //lng
			s[5],       //phone_number
			"official", //source
			time.Now(), //updated_at
		)

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
	ID              int     `json:"id"`
	Toilet          string  `json:"toilet"`
	Nursing         string  `json:"nursing"`
	Lat             float64 `json:"lat"`
	Lng             float64 `json:"lng"`
	Name            string  `json:"name"`
	Others          string  `json:"others"`
	Features        string  `json:"features"`
	Postcode        string  `json:"postcode"`
	Address         string  `json:"address"`
	PhoneNumber     string  `json:"phone_number"`
	OpeningHours    string  `json:"opening_hours"`
	RegularHolidays string  `json:"regular_holidays"`
	Website         string  `json:"website"`
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
		rows, err := db.Query("SELECT id, toilet, nursing, lat, lng, name, others, features, postcode, address, phone_number, opening_hours, regular_holidays, website FROM baby_facilities")
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var facilities []Facility
		for rows.Next() {
			var f Facility
			if err := rows.Scan(&f.ID, &f.Toilet, &f.Nursing, &f.Lat, &f.Lng, &f.Name,
				&f.Others, &f.Features, &f.Postcode, &f.Address, &f.PhoneNumber, &f.OpeningHours,
				&f.RegularHolidays, &f.Website); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			facilities = append(facilities, f)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(facilities)
	})

	// log.Println("Server started at :8080")
	// if err := http.ListenAndServe(":8080", nil); err != nil {
	// 	log.Fatal("ListenAndServe: ", err)
	// }
}
