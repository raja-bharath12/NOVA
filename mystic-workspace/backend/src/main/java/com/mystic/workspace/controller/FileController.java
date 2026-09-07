package com.mystic.workspace.controller;

import com.mystic.workspace.dto.FileDto;
import com.mystic.workspace.entity.FileMetadata;
import com.mystic.workspace.entity.User;
import com.mystic.workspace.repository.UserRepository;
import com.mystic.workspace.security.UserPrincipal;
import com.mystic.workspace.service.FileService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping({"/api/files", "/files", "/api/api/files"})
@RequiredArgsConstructor
public class FileController {

    private final FileService fileService;
    private final UserRepository userRepository;
    private final com.mystic.workspace.security.JwtService jwtService;

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public FileDto uploadFile(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "conversationId", required = false) Long conversationId,
            @RequestParam(value = "isShared", required = false, defaultValue = "false") Boolean isShared
    ) {
        return fileService.uploadFile(currentUser(principal), file, conversationId, isShared);
    }

    @GetMapping
    public List<FileDto> getFiles(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(value = "category", required = false) String category,
            @RequestParam(value = "query", required = false) String query
    ) {
        return fileService.getFiles(currentUser(principal), category, query);
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<?> downloadFile(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id,
            @RequestParam(value = "token", required = false) String tokenParam,
            @RequestParam(value = "jwt", required = false) String jwtParam,
            @RequestParam(value = "auth", required = false) String authParam
    ) {
        User user = null;
        if (principal != null) {
            user = userRepository.findById(principal.getId()).orElse(null);
        }

        if (user == null) {
            String token = tokenParam;
            if (token == null || token.isBlank()) token = jwtParam;
            if (token == null || token.isBlank()) token = authParam;

            if (token != null && !token.isBlank()) {
                try {
                    String email = jwtService.extractUsername(token.trim());
                    if (email != null) {
                        user = userRepository.findByEmail(email).orElse(null);
                    }
                } catch (Exception ignored) {
                }
            }
        }

        FileMetadata metadata = fileService.getFileMetadata(user, id);

        String directUrl = fileService.getDirectDownloadUrl(user, id);
        if (directUrl != null) {
            return ResponseEntity.status(HttpStatus.FOUND)
                    .header(HttpHeaders.LOCATION, directUrl)
                    .build();
        }

        Resource resource = fileService.loadFileAsResource(user, id);

        MediaType mediaType;
        try {
            mediaType = MediaType.parseMediaType(metadata.getMimeType());
        } catch (Exception e) {
            mediaType = MediaType.APPLICATION_OCTET_STREAM;
        }

        String disposition = "inline";
        String mime = metadata.getMimeType() != null ? metadata.getMimeType().toLowerCase() : "";
        if (!mime.startsWith("image/") && !mime.startsWith("video/") && !mime.startsWith("audio/") && !mime.equals("application/pdf") && !mime.startsWith("text/")) {
            disposition = "attachment";
        }

        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition + "; filename=\"" + metadata.getOriginalFilename() + "\"")
                .header(HttpHeaders.CACHE_CONTROL, "max-age=3600, must-revalidate")
                .body(resource);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteFile(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id
    ) {
        fileService.deleteFile(currentUser(principal), id);
        return ResponseEntity.noContent().build();
    }

    private User currentUser(UserPrincipal principal) {
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please sign in to perform this action");
        }
        return userRepository.findById(principal.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }
}
