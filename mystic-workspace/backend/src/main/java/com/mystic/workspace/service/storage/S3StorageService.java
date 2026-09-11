package com.mystic.workspace.service.storage;

import com.mystic.workspace.dto.WatchUploadDtos.CompletedPartDto;
import com.mystic.workspace.entity.FileMetadata;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
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
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.UploadPartPresignRequest;

import java.io.IOException;
import java.io.InputStream;
import java.time.Duration;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
@ConditionalOnProperty(name = "app.storage.type", havingValue = "s3")
@Slf4j
public class S3StorageService implements StorageService {

    @Value("${aws.s3.bucket:nova-watch-together-storage}")
    private String bucketName;

    @Value("${aws.s3.region:ap-south-1}")
    private String region;

    @Value("${aws.s3.access-key:}")
    private String accessKey;

    @Value("${aws.s3.secret-key:}")
    private String secretKey;

    private S3Client s3Client;
    private S3Presigner s3Presigner;

    @PostConstruct
    public void init() {
        Region awsRegion = Region.of(region);

        if (accessKey != null && !accessKey.isBlank() && secretKey != null && !secretKey.isBlank()) {
            log.info("Initializing S3StorageService with static credentials for region {}", region);
            var credentialsProvider = StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secretKey));
            this.s3Client = S3Client.builder()
                    .region(awsRegion)
                    .credentialsProvider(credentialsProvider)
                    .build();
            this.s3Presigner = S3Presigner.builder()
                    .region(awsRegion)
                    .credentialsProvider(credentialsProvider)
                    .build();
        } else {
            // DefaultCredentialsProvider automatically resolves EC2 IAM Role credentials (IMDS)
            log.info("Initializing S3StorageService with AWS DefaultCredentialsProvider (EC2 IAM Role) for region {}", region);
            this.s3Client = S3Client.builder()
                    .region(awsRegion)
                    .build();
            this.s3Presigner = S3Presigner.builder()
                    .region(awsRegion)
                    .build();
        }
    }

    @PreDestroy
    public void destroy() {
        if (s3Client != null) {
            try {
                s3Client.close();
            } catch (Exception ignored) {}
        }
        if (s3Presigner != null) {
            try {
                s3Presigner.close();
            } catch (Exception ignored) {}
        }
    }

    @Override
    public String store(MultipartFile file) {
        return store(file, "uploads");
    }

    @Override
    public String store(MultipartFile file, String keyPrefix) {
        if (file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot store empty file");
        }

        String rawFilename = file.getOriginalFilename();
        String extension = "";
        if (rawFilename != null && rawFilename.contains(".")) {
            extension = rawFilename.substring(rawFilename.lastIndexOf("."));
        }

        String prefix = (keyPrefix != null && !keyPrefix.isBlank()) ? keyPrefix.replaceAll("^/+|/+$", "") : "uploads";
        String storageKey = prefix + "/" + UUID.randomUUID().toString() + extension;

        try {
            PutObjectRequest putRequest = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(storageKey)
                    .contentType(file.getContentType())
                    .build();

            s3Client.putObject(putRequest, RequestBody.fromInputStream(file.getInputStream(), file.getSize()));
            log.info("File successfully uploaded to S3: s3://{}/{}", bucketName, storageKey);
            return storageKey;
        } catch (IOException e) {
            log.error("Failed to upload file to S3: s3://{}/{}", bucketName, storageKey, e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to upload to S3", e);
        }
    }

    @Override
    public Resource loadAsResource(FileMetadata metadata) {
        if (metadata == null || metadata.getStorageKey() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid file metadata");
        }
        return loadAsResource(metadata.getStorageKey());
    }

    @Override
    public Resource loadAsResource(String storageKey) {
        try {
            GetObjectRequest getRequest = GetObjectRequest.builder()
                    .bucket(bucketName)
                    .key(storageKey)
                    .build();

            InputStream is = s3Client.getObject(getRequest);
            return new InputStreamResource(is);
        } catch (NoSuchKeyException e) {
            log.warn("S3 object not found: s3://{}/{}", bucketName, storageKey);
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Object not found in S3", e);
        } catch (Exception e) {
            log.error("Failed to load object from S3: s3://{}/{}", bucketName, storageKey, e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to load object from S3", e);
        }
    }

    @Override
    public void delete(FileMetadata metadata) {
        if (metadata != null && metadata.getStorageKey() != null) {
            delete(metadata.getStorageKey());
        }
    }

    @Override
    public void delete(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) return;
        try {
            DeleteObjectRequest deleteRequest = DeleteObjectRequest.builder()
                    .bucket(bucketName)
                    .key(storageKey)
                    .build();
            s3Client.deleteObject(deleteRequest);
            log.info("Deleted S3 object: s3://{}/{}", bucketName, storageKey);
        } catch (Exception e) {
            log.warn("Could not delete S3 object: s3://{}/{}", bucketName, storageKey, e);
        }
    }

    @Override
    public String getDirectDownloadUrl(FileMetadata metadata) {
        if (metadata == null || metadata.getStorageKey() == null) return null;
        return getDirectDownloadUrl(metadata.getStorageKey(), Duration.ofMinutes(15));
    }

    @Override
    public String getDirectDownloadUrl(String storageKey, Duration duration) {
        if (storageKey == null || storageKey.isBlank()) return null;
        try {
            Duration validity = (duration != null) ? duration : Duration.ofMinutes(15);
            GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                    .bucket(bucketName)
                    .key(storageKey)
                    .build();

            GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                    .signatureDuration(validity)
                    .getObjectRequest(getObjectRequest)
                    .build();

            return s3Presigner.presignGetObject(presignRequest).url().toString();
        } catch (Exception e) {
            log.error("Failed to generate presigned download URL for s3://{}/{}", bucketName, storageKey, e);
            return null;
        }
    }

    @Override
    public String generatePresignedUploadUrl(String storageKey, String contentType, Duration duration) {
        if (storageKey == null || storageKey.isBlank()) return null;
        try {
            Duration validity = (duration != null) ? duration : Duration.ofMinutes(30);
            PutObjectRequest.Builder putBuilder = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(storageKey);

            if (contentType != null && !contentType.isBlank()) {
                putBuilder.contentType(contentType);
            }

            PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
                    .signatureDuration(validity)
                    .putObjectRequest(putBuilder.build())
                    .build();

            return s3Presigner.presignPutObject(presignRequest).url().toString();
        } catch (Exception e) {
            log.error("Failed to generate presigned upload URL for s3://{}/{}", bucketName, storageKey, e);
            return null;
        }
    }

    @Override
    public String initiateMultipartUpload(String storageKey, String contentType) {
        try {
            CreateMultipartUploadRequest.Builder builder = CreateMultipartUploadRequest.builder()
                    .bucket(bucketName)
                    .key(storageKey);

            if (contentType != null && !contentType.isBlank()) {
                builder.contentType(contentType);
            }

            CreateMultipartUploadResponse response = s3Client.createMultipartUpload(builder.build());
            log.info("Initiated S3 multipart upload: key={}, uploadId={}", storageKey, response.uploadId());
            return response.uploadId();
        } catch (Exception e) {
            log.error("Failed to initiate S3 multipart upload for key={}", storageKey, e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to initiate multipart upload", e);
        }
    }

    @Override
    public String generatePresignedPartUploadUrl(String storageKey, String uploadId, int partNumber, Duration duration) {
        try {
            Duration validity = (duration != null) ? duration : Duration.ofMinutes(60);
            UploadPartRequest uploadPartRequest = UploadPartRequest.builder()
                    .bucket(bucketName)
                    .key(storageKey)
                    .uploadId(uploadId)
                    .partNumber(partNumber)
                    .build();

            UploadPartPresignRequest presignRequest = UploadPartPresignRequest.builder()
                    .signatureDuration(validity)
                    .uploadPartRequest(uploadPartRequest)
                    .build();

            return s3Presigner.presignUploadPart(presignRequest).url().toString();
        } catch (Exception e) {
            log.error("Failed to generate presigned part upload URL: key={}, uploadId={}, partNumber={}", storageKey, uploadId, partNumber, e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to generate part upload URL", e);
        }
    }

    @Override
    public void completeMultipartUpload(String storageKey, String uploadId, List<CompletedPartDto> parts) {
        if (parts == null || parts.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No completed parts provided");
        }

        try {
            List<CompletedPart> completedParts = parts.stream()
                    .map(p -> CompletedPart.builder()
                            .partNumber(p.getPartNumber())
                            .eTag(p.getETag().replace("\"", ""))
                            .build())
                    .sorted(Comparator.comparingInt(CompletedPart::partNumber))
                    .toList();

            CompletedMultipartUpload completedMultipartUpload = CompletedMultipartUpload.builder()
                    .parts(completedParts)
                    .build();

            CompleteMultipartUploadRequest completeRequest = CompleteMultipartUploadRequest.builder()
                    .bucket(bucketName)
                    .key(storageKey)
                    .uploadId(uploadId)
                    .multipartUpload(completedMultipartUpload)
                    .build();

            s3Client.completeMultipartUpload(completeRequest);
            log.info("Successfully completed S3 multipart upload for key={}", storageKey);
        } catch (Exception e) {
            log.error("Failed to complete S3 multipart upload for key={}, uploadId={}", storageKey, uploadId, e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to complete multipart upload on S3", e);
        }
    }

    @Override
    public void abortMultipartUpload(String storageKey, String uploadId) {
        if (storageKey == null || uploadId == null) return;
        try {
            AbortMultipartUploadRequest abortRequest = AbortMultipartUploadRequest.builder()
                    .bucket(bucketName)
                    .key(storageKey)
                    .uploadId(uploadId)
                    .build();
            s3Client.abortMultipartUpload(abortRequest);
            log.info("Aborted S3 multipart upload for key={}, uploadId={}", storageKey, uploadId);
        } catch (Exception e) {
            log.warn("Failed to abort S3 multipart upload for key={}, uploadId={}", storageKey, uploadId, e);
        }
    }

    @Override
    public boolean exists(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) return false;
        try {
            HeadObjectRequest headRequest = HeadObjectRequest.builder()
                    .bucket(bucketName)
                    .key(storageKey)
                    .build();
            s3Client.headObject(headRequest);
            return true;
        } catch (NoSuchKeyException e) {
            return false;
        } catch (Exception e) {
            log.warn("Error checking existence of s3://{}/{}", bucketName, storageKey, e);
            return false;
        }
    }

    @Override
    public String getStorageType() {
        return "S3";
    }
}
