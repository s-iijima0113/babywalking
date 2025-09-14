package pdf

import (
	"fmt"
	"log"

	//"github.com/pdfcpu/pdfcpu/pkg/api"
	"code.sajari.com/docconv/v2"
)

// PDFの内容を配列に格納する
func ReadPDF(filePath string) {
	// PDFファイルをテキストに変換
	res, err := docconv.ConvertPath(filePath)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(res)
}
