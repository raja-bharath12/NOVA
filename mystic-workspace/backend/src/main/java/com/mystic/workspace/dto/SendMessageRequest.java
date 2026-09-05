package com.mystic.workspace.dto;

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
public class SendMessageRequest {
    private String content;
    private Long replyToId;
    @Builder.Default
    private List<Long> attachmentFileIds = new ArrayList<>();
}
