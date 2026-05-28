package com.chamasmart.backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.Image;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

@Service
public class ProfilePictureService {
    private static final Logger log = LoggerFactory.getLogger(ProfilePictureService.class);
    private static final Logger log = LoggerFactory.getLogger(ProfilePictureService.class);
    private static final long MAX_SIZE_BYTES = 5L * 1024 * 1024; // 5 MB
    private static final int TARGET_WIDTH = 256;
    private static final int TARGET_HEIGHT = 256;
    private static final String UPLOAD_DIR = "uploads/avatars";

    /**
     * Stores the provided image file, resizes it to 256x256, and returns the absolute URL.
     */
    public String storeProfilePicture(Long userId, MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File is empty");
        }
        if (!file.getContentType().startsWith("image/")) {
            throw new IllegalArgumentException("Only image files are allowed");
        }
        if (file.getSize() > MAX_SIZE_BYTES) {
            throw new IllegalArgumentException("File size exceeds 5 MB limit");
        }

        // Ensure upload directory exists
        Path uploadPath = Paths.get(UPLOAD_DIR);
        Files.createDirectories(uploadPath);

        // Preserve original extension if possible
        String originalFilename = file.getOriginalFilename();
        String ext = "png"; // default
        if (originalFilename != null && originalFilename.contains(".")) {
            ext = originalFilename.substring(originalFilename.lastIndexOf('.') + 1).toLowerCase();
        }
        // Generate a unique filename based on userId
        String filename = "user_" + userId + "_" + UUID.randomUUID() + "." + ext;
        Path destination = uploadPath.resolve(filename);

        // Resize image
        BufferedImage resized = resizeImage(ImageIO.read(file.getInputStream()), TARGET_WIDTH, TARGET_HEIGHT);
        // Write the resized image to disk
        ImageIO.write(resized, ext, destination.toFile());

        log.info("Stored profile picture for user {} at {}", userId, destination.toString());
        return generatePublicUrl(filename);
    }

    private String generatePublicUrl(String filename) {
        return ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/" + UPLOAD_DIR + "/")
                .path(filename)
                .toUriString();
    }

    private BufferedImage resizeImage(BufferedImage originalImage, int targetWidth, int targetHeight) {
        Image scaled = originalImage.getScaledInstance(targetWidth, targetHeight, Image.SCALE_SMOOTH);
        BufferedImage resized = new BufferedImage(targetWidth, targetHeight, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g2d = resized.createGraphics();
        g2d.drawImage(scaled, 0, 0, null);
        g2d.dispose();
        return resized;
    }
}


