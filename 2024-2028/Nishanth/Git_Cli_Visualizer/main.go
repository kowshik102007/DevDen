package main

import (
	"flag"
	"fmt"
)

func main() {
	var folder string
	var email string
	var list bool
	flag.StringVar(&folder, "add", "", "Add a new folder to scan the repositories")
	flag.StringVar(&email, "email", "youremail@gmail.com", "Email to scan")
	flag.BoolVar(&list, "list", false, "List saved repositories")
	flag.Parse()

	if folder != "" {
		scan(folder)
		return
	}

	if list {
		filePath := getDotFilePath()
		repos := parseFileLinesToSlice(filePath)
		if len(repos) == 0 {
			fmt.Printf("No repositories saved in %s\n", filePath)
			return
		}
		fmt.Printf("Saved repositories (%s):\n", filePath)
		for _, r := range repos {
			fmt.Println(r)
		}
		return
	}

	stats(email)
}
