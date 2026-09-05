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
public class CreateConversationRequest {

    @NotNull
    private String type; // DIRECT or GROUP

    private String title;

    // For DIRECT: single recipient ID. For GROUP: list of member IDs.
    private Long recipientId;

    @Builder.Default
    private List<Long> memberIds = new ArrayList<>();
}
