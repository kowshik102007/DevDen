package com.example.demo.model;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.util.List;

public class FileManager {
    private String filePath;
    private String fileName;
    private String fileFormat;

    public FileManager(String filePath, String fileName, String fileFormat) {
        this.filePath = filePath;
        this.fileName = fileName;
        this.fileFormat = fileFormat;
    }

    private File getFile() {
        File directory = new File(filePath);
        if (!directory.exists()) {
            directory.mkdirs();
        }
        return new File(directory, fileName + "." + fileFormat);
    }

    public void saveToFile(String data) {
        try (FileWriter writer = new FileWriter(getFile())) {
            writer.write(data);
            System.out.println("File saved successfully.");
        } catch (IOException e) {
            System.out.println("Error saving file: " + e.getMessage());
        }
    } 

    public void saveToFile(List<Reservation> reservations) {
        StringBuilder content = new StringBuilder();
        for (Reservation reservation : reservations) {
            content.append(reservation).append(System.lineSeparator());
        }
        saveToFile(content.toString());
    }

    public String readFromFile() {
        StringBuilder content = new StringBuilder();
        File file = getFile();

        if (!file.exists()) {
            return "";
        }

        try (BufferedReader reader = new BufferedReader(new FileReader(file))) {
            String line;
            while ((line = reader.readLine()) != null) {
                content.append(line).append(System.lineSeparator());
            }
        } catch (IOException e) {
            System.out.println("Error reading file: " + e.getMessage());
        }
        return content.toString();
    }

    public void updateFile(String newData) {
        saveToFile(newData);
    }

    public boolean deleteFile() {
        File file = getFile();
        return file.exists() && file.delete();
    }

    public boolean fileExists() {
        return getFile().exists();
    }
}