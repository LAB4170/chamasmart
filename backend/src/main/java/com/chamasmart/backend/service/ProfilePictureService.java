package com.chamasmart.backend.service;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class ProfilePictureService {
    private static final long MAX_SIZE_BYTES = 5L * 1024 * 1024; // 5 MB
    
    private final Cloudinary cloudinary;

    /**
     * Stores the provided image file to Cloudinary and returns the absolute URL.
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

        String publicId = "user_" + userId + "_" + UUID.randomUUID().toString().substring(0, 8);

        @SuppressWarnings("unchecked")
        Map<String, Object> uploadResult = cloudinary.uploader().upload(file.getBytes(), ObjectUtils.asMap(
                "folder", "chamasmart/avatars",
                "public_id", publicId,
                "overwrite", true,
                "transformation", "c_fill,h_256,w_256"
        ));

        String url = uploadResult.get("secure_url").toString();
        log.info("Stored profile picture for user {} at {}", userId, url);
        return url;
    }
}

