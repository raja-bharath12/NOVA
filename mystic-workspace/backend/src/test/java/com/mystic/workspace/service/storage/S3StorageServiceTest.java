package com.mystic.workspace.service.storage;

import com.mystic.workspace.dto.WatchUploadDtos.CompletedPartDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.io.Resource;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.*;

import java.io.ByteArrayInputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class S3StorageServiceTest {

    @Mock
    private S3Client s3Client;

    @Mock
    private S3Presigner s3Presigner;

    @InjectMocks
    private S3StorageService s3StorageService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(s3StorageService, "bucketName", "nova-watch-together-storage");
        ReflectionTestUtils.setField(s3StorageService, "region", "ap-south-1");
        ReflectionTestUtils.setField(s3StorageService, "accessKey", "");
        ReflectionTestUtils.setField(s3StorageService, "secretKey", "");
        ReflectionTestUtils.setField(s3StorageService, "s3Client", s3Client);
        ReflectionTestUtils.setField(s3StorageService, "s3Presigner", s3Presigner);
    }

    @Test
    @DisplayName("Verify Spring Boot can upload a small object to S3")
    void testUploadObjectToS3() {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "test-sample.txt",
                "text/plain",
                "Hello NOVA S3 Watch Together!".getBytes(StandardCharsets.UTF_8)
        );

        when(s3Client.putObject(any(PutObjectRequest.class), any(RequestBody.class)))
                .thenReturn(PutObjectResponse.builder().build());

        String storageKey = s3StorageService.store(file, "watch-media/test-id/original");

        assertThat(storageKey).isNotNull();
        assertThat(storageKey).startsWith("watch-media/test-id/original/");
        assertThat(storageKey).endsWith(".txt");

        verify(s3Client).putObject(any(PutObjectRequest.class), any(RequestBody.class));
    }

    @Test
    @DisplayName("Verify Spring Boot can read/access an object from S3")
    void testReadObjectFromS3() throws Exception {
        String testKey = "watch-media/test-id/original/test.txt";
        byte[] content = "Streaming test content".getBytes(StandardCharsets.UTF_8);

        GetObjectResponse getResponse = GetObjectResponse.builder()
                .contentLength((long) content.length)
                .contentType("text/plain")
                .build();

        ResponseInputStream<GetObjectResponse> responseStream = new ResponseInputStream<>(
                getResponse,
                new ByteArrayInputStream(content)
        );

        when(s3Client.getObject(any(GetObjectRequest.class))).thenReturn(responseStream);

        Resource resource = s3StorageService.loadAsResource(testKey);

        assertThat(resource).isNotNull();
        assertThat(resource.getInputStream().readAllBytes()).isEqualTo(content);
        verify(s3Client).getObject(any(GetObjectRequest.class));
    }

    @Test
    @DisplayName("Verify Spring Boot can delete an object from S3")
    void testDeleteObjectFromS3() {
        String testKey = "watch-media/test-id/original/test.txt";
        when(s3Client.deleteObject(any(DeleteObjectRequest.class)))
                .thenReturn(DeleteObjectResponse.builder().build());

        s3StorageService.delete(testKey);

        verify(s3Client).deleteObject(any(DeleteObjectRequest.class));
    }

    @Test
    @DisplayName("Verify Presigned Download & Streaming URL Generation (Time-Limited)")
    void testPresignedDownloadUrl() throws Exception {
        String testKey = "watch-media/test-id/original/video.mp4";
        PresignedGetObjectRequest presigned = mock(PresignedGetObjectRequest.class);
        when(presigned.url()).thenReturn(new URL("https://nova-watch-together-storage.s3.ap-south-1.amazonaws.com/watch-media/test-id/original/video.mp4?X-Amz-Security-Token=xyz"));
        when(s3Presigner.presignGetObject(any(GetObjectPresignRequest.class))).thenReturn(presigned);

        String url = s3StorageService.getDirectDownloadUrl(testKey, Duration.ofHours(2));

        assertThat(url).isNotNull();
        assertThat(url).contains("nova-watch-together-storage");
        assertThat(url).contains("watch-media/test-id/original/video.mp4");
        verify(s3Presigner).presignGetObject(any(GetObjectPresignRequest.class));
    }

    @Test
    @DisplayName("Verify Presigned Direct Upload URL Generation for Large Video Files")
    void testPresignedUploadUrl() throws Exception {
        String testKey = "watch-media/upload-123/original/raw-movie.mp4";
        PresignedPutObjectRequest presigned = mock(PresignedPutObjectRequest.class);
        when(presigned.url()).thenReturn(new URL("https://nova-watch-together-storage.s3.ap-south-1.amazonaws.com/watch-media/upload-123/original/raw-movie.mp4?X-Amz-Signature=abc"));
        when(s3Presigner.presignPutObject(any(PutObjectPresignRequest.class))).thenReturn(presigned);

        String uploadUrl = s3StorageService.generatePresignedUploadUrl(testKey, "video/mp4", Duration.ofMinutes(45));

        assertThat(uploadUrl).isNotNull();
        assertThat(uploadUrl).contains("nova-watch-together-storage");
        verify(s3Presigner).presignPutObject(any(PutObjectPresignRequest.class));
    }

    @Test
    @DisplayName("Verify S3 Multipart Upload Lifecycle (Initiate, Part URL, Complete, Abort)")
    void testMultipartUploadLifecycle() throws Exception {
        String testKey = "watch-media/large-video/original/movie.mp4";

        // 1. Initiate
        when(s3Client.createMultipartUpload(any(CreateMultipartUploadRequest.class)))
                .thenReturn(CreateMultipartUploadResponse.builder().uploadId("upload-id-999").build());

        String uploadId = s3StorageService.initiateMultipartUpload(testKey, "video/mp4");
        assertThat(uploadId).isEqualTo("upload-id-999");

        // 2. Presign Part URL
        PresignedUploadPartRequest presignedPart = mock(PresignedUploadPartRequest.class);
        when(presignedPart.url()).thenReturn(new URL("https://nova-watch-together-storage.s3.ap-south-1.amazonaws.com/part-1-url"));
        when(s3Presigner.presignUploadPart(any(UploadPartPresignRequest.class))).thenReturn(presignedPart);

        String partUrl = s3StorageService.generatePresignedPartUploadUrl(testKey, uploadId, 1, Duration.ofMinutes(60));
        assertThat(partUrl).isEqualTo("https://nova-watch-together-storage.s3.ap-south-1.amazonaws.com/part-1-url");

        // 3. Complete
        when(s3Client.completeMultipartUpload(any(CompleteMultipartUploadRequest.class)))
                .thenReturn(CompleteMultipartUploadResponse.builder().build());

        s3StorageService.completeMultipartUpload(testKey, uploadId, List.of(
                new CompletedPartDto(1, "\"etag-1\""),
                new CompletedPartDto(2, "\"etag-2\"")
        ));
        verify(s3Client).completeMultipartUpload(any(CompleteMultipartUploadRequest.class));

        // 4. Abort
        when(s3Client.abortMultipartUpload(any(AbortMultipartUploadRequest.class)))
                .thenReturn(AbortMultipartUploadResponse.builder().build());

        s3StorageService.abortMultipartUpload(testKey, uploadId);
        verify(s3Client).abortMultipartUpload(any(AbortMultipartUploadRequest.class));
    }

    @Test
    @DisplayName("Verify Object Existence Check")
    void testObjectExists() {
        String testKey = "watch-media/test-id/original/test.txt";
        when(s3Client.headObject(any(HeadObjectRequest.class))).thenReturn(HeadObjectResponse.builder().build());

        boolean exists = s3StorageService.exists(testKey);

        assertThat(exists).isTrue();
        verify(s3Client).headObject(any(HeadObjectRequest.class));
    }
}
