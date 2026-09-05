package com.mystic.workspace.service.storage;

import com.mystic.workspace.entity.FileMetadata;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

import java.io.IOException;
import java.io.InputStream;
import java.time.Duration;
import java.util.UUID;

@Service
@ConditionalOnProperty(name = "app.storage.type", havingValue = "s3")
public class S3StorageService implements StorageService {

    @Value("${aws.s3.bucket}")
    private String bucketName;

    @Value("${aws.s3.region:us-east-1}")
    private String region;

    @Value("${aws.s3.access-key:}")
    private String accessKey;

    @Value("${aws.s3.secret-key:}")
    private String secretKey;

    private S3Client s3Client() {
        if (accessKey != null && !accessKey.isBlank() && secretKey != null && !secretKey.isBlank()) {
            return S3Client.builder()
                    .region(Region.of(region))
                    .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secretKey)))
                    .build();
        }
        return S3Client.builder().region(Region.of(region)).build();
    }

    private S3Presigner s3Presigner() {
        if (accessKey != null && !accessKey.isBlank() && secretKey != null && !secretKey.isBlank()) {
            return S3Presigner.builder()
                    .region(Region.of(region))
                    .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secretKey)))
                    .build();
        }
        return S3Presigner.builder().region(Region.of(region)).build();
    }

    @Override
    public String store(MultipartFile file) {
        String rawFilename = file.getOriginalFilename();
        String extension = "";
        if (rawFilename != null && rawFilename.contains(".")) {
            extension = rawFilename.substring(rawFilename.lastIndexOf("."));
        }
        String storageKey = "uploads/" + UUID.randomUUID().toString() + extension;

        try {
            PutObjectRequest putRequest = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(storageKey)
                    .contentType(file.getContentType())
                    .build();

            s3Client().putObject(putRequest, RequestBody.fromInputStream(file.getInputStream(), file.getSize()));
            return storageKey;
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to upload to S3", e);
        }
    }

    @Override
    public Resource loadAsResource(FileMetadata metadata) {
        try {
            GetObjectRequest getRequest = GetObjectRequest.builder()
                    .bucket(bucketName)
                    .key(metadata.getStorageKey())
                    .build();

            InputStream is = s3Client().getObject(getRequest);
            return new InputStreamResource(is);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Failed to download from S3", e);
        }
    }

    @Override
    public void delete(FileMetadata metadata) {
        try {
            DeleteObjectRequest deleteRequest = DeleteObjectRequest.builder()
                    .bucket(bucketName)
                    .key(metadata.getStorageKey())
                    .build();
            s3Client().deleteObject(deleteRequest);
        } catch (Exception ignored) {
        }
    }

    @Override
    public String getDirectDownloadUrl(FileMetadata metadata) {
        try {
            GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                    .bucket(bucketName)
                    .key(metadata.getStorageKey())
                    .build();

            GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                    .signatureDuration(Duration.ofMinutes(15))
                    .getObjectRequest(getObjectRequest)
                    .build();

            return s3Presigner().presignGetObject(presignRequest).url().toString();
        } catch (Exception e) {
            return null;
        }
    }
}
