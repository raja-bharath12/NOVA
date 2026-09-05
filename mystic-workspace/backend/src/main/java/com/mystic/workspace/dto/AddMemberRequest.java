package com.mystic.workspace.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AddMemberRequest {
    @NotNull
    @Builder.Default
    private List<Long> userIds = new ArrayList<>();
}
