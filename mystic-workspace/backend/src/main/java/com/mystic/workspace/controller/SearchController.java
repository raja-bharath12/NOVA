package com.mystic.workspace.controller;

import com.mystic.workspace.dto.GlobalSearchResultDto;
import com.mystic.workspace.entity.User;
import com.mystic.workspace.repository.UserRepository;
import com.mystic.workspace.security.UserPrincipal;
import com.mystic.workspace.service.SearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/search")
@RequiredArgsConstructor
public class SearchController {

    private final SearchService searchService;
    private final UserRepository userRepository;

    @GetMapping
    public List<GlobalSearchResultDto> search(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam("q") String query
    ) {
        return searchService.searchWorkspace(currentUser(principal), query);
    }

    private User currentUser(UserPrincipal principal) {
        return userRepository.findById(principal.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }
}
