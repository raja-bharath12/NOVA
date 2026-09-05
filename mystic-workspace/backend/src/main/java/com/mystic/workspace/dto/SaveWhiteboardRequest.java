package com.mystic.workspace.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SaveWhiteboardRequest {
    private Long id;
    @NotBlank
    private String title;
    private String dataJson;
    private String meetingRoomCode;
}
