package main

import (
	"bufio"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"os"
	"os/user"
	"path/filepath"
	"strings"
)

// Get the dotfile for repo list
func getDotFilePath() string {
	usr, err := user.Current()
	if err == nil {
		return filepath.Join(usr.HomeDir, ".gogitlocalstats")
	}

	// fallback to environment variables if user.Current() fails
	home := os.Getenv("HOME")
	if home == "" {
		home = os.Getenv("USERPROFILE")
	}
	if home != "" {
		return filepath.Join(home, ".gogitlocalstats")
	}

	// final fallback: current directory
	if cwd, err := os.Getwd(); err == nil {
		return filepath.Join(cwd, ".gogitlocalstats")
	}

	return ".gogitlocalstats"
}

// Open the file present at the given path
func openFile(path string) *os.File {
	// use O_CREATE so the file is created if it does not exist
	file, err := os.OpenFile(path, os.O_APPEND|os.O_RDWR|os.O_CREATE, 0644)
	if err != nil {
		log.Printf("error opening or creating file %s: %v", path, err)
		return nil
	}
	return file
}

func parseFileLinesToSlice(filePath string) []string {
	f := openFile(filePath)
	if f == nil {
		return []string{}
	}
	defer f.Close()

	var lines []string
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}
	if err := scanner.Err(); err != nil {
		if err != io.EOF {
			log.Printf("error reading %s: %v", filePath, err)
		}
	}
	return lines
}

func sliceContains(slice []string, value string) bool {
	for _, v := range slice {
		if v == value {
			return true
		}
	}
	return false
}

func joinSlices(new []string, existing []string) []string {
	for _, i := range new {
		if !sliceContains(existing, i) {
			existing = append(existing, i)
		}
	}
	return existing
}

func dumpStringsSliceToFile(repos []string, filePath string) {
	content := strings.Join(repos, "\n")
	if err := ioutil.WriteFile(filePath, []byte(content), 0644); err != nil {
		log.Printf("error writing to %s: %v", filePath, err)
	}
}

func addNewSliceElementsToFile(filePath string, newRepos []string) {
	existingRepos := parseFileLinesToSlice(filePath)
	repos := joinSlices(newRepos, existingRepos)
	dumpStringsSliceToFile(repos, filePath)
}

func recursiveScanFolder(folder string) []string {
	return scanGitFolders(make([]string, 0), folder)
}

func scan(folder string) {
	fmt.Printf("Found folders:\n\n")
	repositories := recursiveScanFolder(folder)
	filePath := getDotFilePath()
	addNewSliceElementsToFile(filePath, repositories)
	fmt.Printf("\n\nSuccessfully added\n\n")
}

func scanGitFolders(folders []string, folder string) []string {
	folder = strings.TrimSuffix(folder, "/")

	f, err := os.Open(folder)
	if err != nil {
		log.Printf("cannot open folder %s: %v", folder, err)
		return folders
	}
	files, err := f.Readdir(-1)
	f.Close()
	if err != nil {
		log.Printf("error reading folder %s: %v", folder, err)
		return folders
	}

	var path string

	for _, file := range files {
		if file.IsDir() {
			path = filepath.Join(folder, file.Name())
			if file.Name() == ".git" {
				path = strings.TrimSuffix(path, string(os.PathSeparator)+".git")
				fmt.Println(path)
				folders = append(folders, path)
				continue
			}
			if file.Name() == "vendor" || file.Name() == "node_modules" {
				continue
			}
			folders = scanGitFolders(folders, path)
		}
	}

	return folders
}
