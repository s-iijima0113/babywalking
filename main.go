package main

import (
	"fmt"
	"html/template"
	"log"
	"net/http"
)

func main() {
	fs := http.FileServer(http.Dir("static"))
	http.Handle("/static/", http.StripPrefix("/static/", fs))

	http.HandleFunc("/", handler)
	http.HandleFunc("/search", searchHandler)
	log.Fatal(http.ListenAndServe(":8080", nil))
}

func handler(w http.ResponseWriter, r *http.Request) {
	tmpl := template.Must(template.ParseFiles("templates/index.html"))
	tmpl.Execute(w, nil)
}

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
	fmt.Fprintf(w, "検索条件を受け取りました。feel=%s, facility=%s, time=%s, shade=%s", feelValues, facilityValues, time, shade)
}
