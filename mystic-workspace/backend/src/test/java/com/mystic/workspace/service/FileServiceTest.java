package com.mystic.workspace.service;

import com.mystic.workspace.dto.FileDto;
import com.mystic.workspace.entity.FileMetadata;
import com.mystic.workspace.entity.User;
import com.mystic.workspace.repository.ConversationMemberRepository;
import com.mystic.workspace.repository.ConversationRepository;
import com.mystic.workspace.repository.FileMetadataRepository;
import com.mystic.workspace.service.storage.StorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FileServiceTest {

    @Mock
    private FileMetadataRepository fileMetadataRepository;

    @Mock
    private ConversationRepository conversationRepository;

    @Mock
    private ConversationMemberRepository conversationMemberRepository;

    @Mock
    private StorageService storageService;

    @InjectMocks
    private FileService fileService;

    private User user1;

    @BeforeEach
    void setUp() {
        user1 = User.builder().id(1L).name("User One").email("user1@nova.test").build();
    }

    @Test
    void testUploadFile() {
        MockMultipartFile file = new MockMultipartFile("file", "test-doc.pdf", "application/pdf", "PDF content".getBytes());

        when(storageService.store(file)).thenReturn("uuid-test-key.pdf");

        FileMetadata saved = FileMetadata.builder()
                .id(101L)
                .originalFilename("test-doc.pdf")
                .storageKey("uuid-test-key.pdf")
                .mimeType("application/pdf")
                .fileSize(11L)
                .owner(user1)
                .build();

        when(fileMetadataRepository.save(any(FileMetadata.class))).thenReturn(saved);

        FileDto result = fileService.uploadFile(user1, file, null, false);

        assertNotNull(result);
        assertEquals("test-doc.pdf", result.getOriginalFilename());
        assertEquals("application/pdf", result.getMimeType());
        verify(storageService).store(file);
        verify(fileMetadataRepository).save(any(FileMetadata.class));
    }

    @Test
    void testDeleteFile() {
        FileMetadata existing = FileMetadata.builder()
                .id(101L)
                .originalFilename("test-doc.pdf")
                .storageKey("uuid-test-key.pdf")
                .owner(user1)
                .build();

        when(fileMetadataRepository.findById(101L)).thenReturn(Optional.of(existing));

        fileService.deleteFile(user1, 101L);

        verify(storageService).delete(existing);
        verify(fileMetadataRepository).delete(existing);
    }
}
