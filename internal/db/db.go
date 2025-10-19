package db

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	pq "github.com/lib/pq"
)

var DB *sql.DB

// DB初期化
func InitDB() {
	dsn := "host=localhost port=5432 user=postgres password=password dbname=babywalking sslmode=disable"
	var err error
	DB, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Fatal(err)
	}

	if err := DB.Ping(); err != nil {
		log.Fatal(err)
	}

	fmt.Println("DBに接続しました")
}

// feel_spotsテーブルに登録するスポット情報
type feelSpotSeed struct {
	Name        string
	Feel        []string
	Lat         float64
	Lng         float64
	Description string
}

var defaultFeelSpotSeeds = []feelSpotSeed{
	{
		Name:        "けやきひろば",
		Feel:        []string{"meet-up", "shopping"},
		Lat:         35.8936,
		Lng:         139.6339,
		Description: "イベントやマルシェが開かれる開放的な広場。",
	},
	{
		Name:        "大宮公園",
		Feel:        []string{"nature", "meet-up"},
		Lat:         35.9084,
		Lng:         139.6336,
		Description: "木陰が気持ちいい自然豊かな定番スポット。",
	},
	{
		Name:        "コクーンシティ",
		Feel:        []string{"shopping", "meet-up"},
		Lat:         35.9004,
		Lng:         139.6339,
		Description: "ランチやショッピングを楽しめる大型商業施設。",
	},
	{
		Name:        "Roastery Saitama",
		Feel:        []string{"cafe", "meet-up"},
		Lat:         35.8619,
		Lng:         139.6478,
		Description: "自家焙煎コーヒーが人気の落ち着いたカフェ。",
	},
	{
		Name:        "Cafe Bonheur",
		Feel:        []string{"cafe"},
		Lat:         35.8721,
		Lng:         139.6474,
		Description: "ベビーカーでも入りやすいスイーツカフェ。",
	},
	{
		Name:        "見沼たんぼ遊歩道",
		Feel:        []string{"nature"},
		Lat:         35.9051,
		Lng:         139.6805,
		Description: "のんびり歩ける水辺の散策コース。",
	},
}

// FeelSpot は散策ルートに組み込むスポットを表します。
type FeelSpot struct {
	ID          int      `json:"id"`
	Name        string   `json:"name"`
	Feel        []string `json:"feel"`
	Lat         float64  `json:"lat"`
	Lng         float64  `json:"lng"`
	Description string   `json:"description"`
}

// EnsureFeelSpotsTable は feel_spots テーブルを作成します。
func EnsureFeelSpotsTable() {
	const ddl = `CREATE TABLE IF NOT EXISTS feel_spots (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        feel TEXT[] NOT NULL,
        lat DOUBLE PRECISION NOT NULL,
        lng DOUBLE PRECISION NOT NULL,
        description TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`

	if _, err := DB.Exec(ddl); err != nil {
		log.Fatal(err)
	}
}

// CheckExistsFeelSpots は feel_spots テーブルにレコードが存在するか確認します。
func CheckExistsFeelSpots() bool {
	var exists bool
	err := DB.QueryRow(`SELECT EXISTS (SELECT 1 FROM feel_spots)`).Scan(&exists)
	if err != nil {
		log.Fatal(err)
	}
	return exists
}

// AddDbFeelSpots は初期スポットデータを登録します。
func AddDbFeelSpots(seeds []feelSpotSeed) {
	const sqlStatement = `INSERT INTO feel_spots (name, feel, lat, lng, description, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $6)`

	tx, err := DB.Begin()
	if err != nil {
		log.Fatal(err)
	}
	defer tx.Rollback()

	now := time.Now()

	for _, seed := range seeds {
		if _, err := tx.Exec(sqlStatement,
			seed.Name,
			pq.Array(seed.Feel),
			seed.Lat,
			seed.Lng,
			seed.Description,
			now,
		); err != nil {
			log.Fatal(err)
		}
	}

	if err := tx.Commit(); err != nil {
		log.Fatal(err)
	}
	fmt.Println("feel_spotsデータを挿入しました")
}

// SeedFeelSpots は feel_spots テーブルに初期データを投入します。
func SeedFeelSpots() {
	if CheckExistsFeelSpots() {
		fmt.Println("すでにfeel_spotsデータが存在するのでINSERTはスキップします")
		return
	}
	AddDbFeelSpots(defaultFeelSpotSeeds)
}

// facilitiesテーブルデータの有無をチェック
func CheckExists() bool {
	var exists bool
	//データチェック
	err := DB.QueryRow(`SELECT EXISTS (SELECT 1 FROM baby_facilities)`).Scan(&exists)
	if err != nil {
		log.Fatal(err)
	}
	return exists
}

// オープンデータ（赤ちゃんの駅）登録
func AddDb(edited [][]string) {
	//SQL
	sql := `INSERT INTO baby_facilities (name, toilet, nursing, others, features, postcode, address, lat, lng, geom, phone_number, opening_hours, regular_holidays, website, source, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, ST_SetSRID(ST_MakePoint($9, $8), 4326)::geography, $10, $11, $12, $13, $14, $15)`

	//トランザクション開始
	tx, err := DB.Begin()
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

// cafeテーブルデータの有無をチェック
func CheckExists_Cafe() bool {
	var exists bool
	//データチェック
	err := DB.QueryRow(`SELECT EXISTS (SELECT 1 FROM cafes)`).Scan(&exists)
	if err != nil {
		log.Fatal(err)
	}
	return exists
}

// オープンデータ（カフェ）登録
func AddDb_Cafe(edited [][]string) {
	//SQL
	sql := `INSERT INTO cafes (name, postcode, address, lat, lng, geom, phone_number, opening_hours, regular_holidays, website, benefit, source, updated_at)
		VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography, $6, $7, $8, $9, $10, $11, $12)`
	//トランザクション開始
	tx, err := DB.Begin()
	if err != nil {
		log.Fatal(err)
	}
	defer tx.Rollback()

	//データ挿入
	for _, s := range edited {

		//insert
		_, err = tx.Exec(sql,
			s[0],       //name
			s[1],       //postcode
			s[2],       //address
			s[8],       //lat
			s[9],       //lng
			s[3],       //phone_number
			s[4],       //opening_hours
			s[5],       //regular_holidays
			s[6],       //website
			s[7],       //benefit
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
	fmt.Println("cafesデータを挿入しました")

}

// coinテーブルデータの有無をチェック
func CheckExists_Coin() bool {
	var exists bool
	//データチェック
	err := DB.QueryRow(`SELECT EXISTS (SELECT 1 FROM coins)`).Scan(&exists)
	if err != nil {
		log.Fatal(err)
	}
	return exists
}

// オープンデータ（さいコイン・たまポン）登録
func AddDb_Coin(edited [][]string) {
	//SQL
	sql := `INSERT INTO coins (name, category, cointype, postcode, address, lat, lng, geom, phone_number, source, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, ST_SetSRID(ST_MakePoint($7, $6), 4326)::geography, $8, $9, $10)`

	//トランザクション開始
	tx, err := DB.Begin()
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
	http.HandleFunc("/api/facilities", func(w http.ResponseWriter, r *http.Request) {
		rows, err := DB.Query("SELECT id, toilet, nursing, lat, lng, name, others, features, postcode, address, phone_number, opening_hours, regular_holidays, website FROM baby_facilities")
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
}

// coinsテーブル用の構造体
type Coin struct {
	ID          int     `json:"id"`
	Name        string  `json:"name"`
	Category    string  `json:"category"`
	Cointype    string  `json:"cointype"`
	Postcode    string  `json:"postcode"`
	Address     string  `json:"address"`
	Lat         float64 `json:"lat"`
	Lng         float64 `json:"lng"`
	Geom        string  `json:"geom"`
	PhoneNumber string  `json:"phone_number"`
}

func CoinAPI() {
	http.HandleFunc("/api/coins", func(w http.ResponseWriter, r *http.Request) {
		rows, err := DB.Query("SELECT id, name, category, cointype, postcode, address, lat, lng, geom, phone_number FROM coins")
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var coins []Coin
		for rows.Next() {
			var c Coin
			if err := rows.Scan(&c.ID, &c.Name, &c.Category, &c.Cointype, &c.Postcode, &c.Address, &c.Lat, &c.Lng, &c.Geom, &c.PhoneNumber); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			coins = append(coins, c)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(coins)
	})
}

// FeelSpotAPI は散策スポットを返す API を提供します。
func FeelSpotAPI() {
	http.HandleFunc("/api/feel-spots", func(w http.ResponseWriter, r *http.Request) {
		rows, err := DB.Query("SELECT id, name, feel, lat, lng, description FROM feel_spots ORDER BY id")
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var spots []FeelSpot
		for rows.Next() {
			var spot FeelSpot
			var feel pq.StringArray
			if err := rows.Scan(&spot.ID, &spot.Name, &feel, &spot.Lat, &spot.Lng, &spot.Description); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			spot.Feel = append(spot.Feel, feel...)
			spots = append(spots, spot)
		}

		if err := rows.Err(); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(spots)
	})
}
