package com.mystic.workspace.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WhiteboardOpDto {
    public enum Type {
        DRAW_START,
        DRAW_MOVE,
        DRAW_END,
        ADD_SHAPE,
        ADD_TEXT,
        ERASE,
        CLEAR,
        UNDO,
        REDO,
        CURSOR_MOVE
    }

    private Type type;
    private Long boardId;
    private String roomCode;
    private Long userId;
    private String userName;
    private String userColor;

    // Vector / Shape data payload
    private String tool; // pen, line, rect, circle, arrow, text, eraser
    private String color;
    private Integer strokeWidth;
    private Double x;
    private Double y;
    private Double endX;
    private Double endY;
    private String text;
    private Object points; // List of {x, y} for smooth brush paths
}
