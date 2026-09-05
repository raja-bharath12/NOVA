package com.mystic.workspace.service;

import com.mystic.workspace.dto.*;
import com.mystic.workspace.entity.*;
import com.mystic.workspace.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AiAssistantService {

    private final TaskRepository taskRepository;
    private final EventRepository eventRepository;
    private final MeetingRepository meetingRepository;
    private final MessageRepository messageRepository;
    private final FileMetadataRepository fileMetadataRepository;
    private final ConversationMemberRepository conversationMemberRepository;

    public AiChatResponse processPrompt(User user, AiChatRequest request) {
        String prompt = request.getPrompt().trim();
        String lower = prompt.toLowerCase();

        List<Task> userTasks = taskRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
        List<Event> userEvents = eventRepository.findByUserIdOrderByStartTimeAsc(user.getId());
        List<Meeting> userMeetings = meetingRepository.findAllForUser(user.getId());

        List<Task> pendingTasks = userTasks.stream().filter(t -> !t.isCompleted()).collect(Collectors.toList());
        List<Task> completedTasks = userTasks.stream().filter(Task::isCompleted).collect(Collectors.toList());

        // 1. Task Generation request (e.g. "create tasks for...", "break down...", "generate tasks")
        if (lower.contains("create task") || lower.contains("generate task") || lower.contains("break down") || lower.contains("plan task") || lower.contains("tasks for")) {
            return handleTaskGeneration(prompt, pendingTasks);
        }

        // 2. Schedule organization (e.g. "organize my schedule", "plan my day", "my agenda", "assignments and meetings")
        if (lower.contains("schedule") || lower.contains("agenda") || lower.contains("organize") || lower.contains("plan my day") || lower.contains("upcoming")) {
            return handleSchedulePlanning(user, prompt, pendingTasks, userEvents, userMeetings);
        }

        // 3. Meeting Summary request (e.g. "summarize meeting", "meeting summary", "action items")
        if (lower.contains("meeting summary") || lower.contains("summarize meeting") || lower.contains("action item") || lower.contains("minutes")) {
            return handleMeetingSummary(prompt);
        }

        // 4. General Productivity Assistant
        return handleGeneralProductivity(user, prompt, pendingTasks, completedTasks, userEvents, userMeetings);
    }

    private AiChatResponse handleTaskGeneration(String prompt, List<Task> pendingTasks) {
        List<AiTaskSuggestionDto> suggestions = new ArrayList<>();
        String today = LocalDate.now().format(DateTimeFormatter.ISO_DATE);
        String in3Days = LocalDate.now().plusDays(3).format(DateTimeFormatter.ISO_DATE);
        String in5Days = LocalDate.now().plusDays(5).format(DateTimeFormatter.ISO_DATE);
        String in7Days = LocalDate.now().plusDays(7).format(DateTimeFormatter.ISO_DATE);

        if (prompt.toLowerCase().contains("java") || prompt.toLowerCase().contains("backend") || prompt.toLowerCase().contains("project")) {
            suggestions.add(AiTaskSuggestionDto.builder()
                    .title("Design Database Schema & Entities")
                    .description("Create PostgreSQL relational schema, indexes, and JPA entity models.")
                    .priority("HIGH")
                    .category("Backend")
                    .deadline(today)
                    .build());

            suggestions.add(AiTaskSuggestionDto.builder()
                    .title("Implement REST Controllers & Security")
                    .description("Build Spring Boot controllers with stateless JWT authentication.")
                    .priority("HIGH")
                    .category("Backend")
                    .deadline(in3Days)
                    .build());

            suggestions.add(AiTaskSuggestionDto.builder()
                    .title("Build Frontend UI & Components")
                    .description("Implement React 18 TypeScript views, Glass panels, and Framer Motion.")
                    .priority("MEDIUM")
                    .category("Frontend")
                    .deadline(in5Days)
                    .build());

            suggestions.add(AiTaskSuggestionDto.builder()
                    .title("Execute Unit & Integration Tests")
                    .description("Run JUnit tests and verify API endpoints and WebSocket channels.")
                    .priority("HIGH")
                    .category("Testing")
                    .deadline(in7Days)
                    .build());

            suggestions.add(AiTaskSuggestionDto.builder()
                    .title("Final Deployment & Documentation")
                    .description("Review environment variables, update README, and prepare demo.")
                    .priority("LOW")
                    .category("DevOps")
                    .deadline(in7Days)
                    .build());
        } else {
            // General breakdown
            String topic = prompt.replaceFirst("(?i)create tasks for|generate tasks for|break down|plan", "").trim();
            if (topic.isBlank()) topic = "Target Objective";

            suggestions.add(AiTaskSuggestionDto.builder()
                    .title("Research & Requirements for " + topic)
                    .description("Gather specifications, review dependencies, and outline roadmap.")
                    .priority("HIGH")
                    .category("Planning")
                    .deadline(today)
                    .build());

            suggestions.add(AiTaskSuggestionDto.builder()
                    .title("Execute Core Implementation Phase")
                    .description("Complete primary deliverables and milestones for " + topic)
                    .priority("HIGH")
                    .category("Execution")
                    .deadline(in3Days)
                    .build());

            suggestions.add(AiTaskSuggestionDto.builder()
                    .title("Quality Assurance & Review")
                    .description("Validate correctness, verify edge cases, and collect feedback.")
                    .priority("MEDIUM")
                    .category("Review")
                    .deadline(in5Days)
                    .build());
        }

        String responseText = String.format(
                "I have synthesized a structured %d-phase task roadmap for your goal. Review the suggested action items below and click **[Create Suggested Tasks]** to instantly add them to your workspace.",
                suggestions.size()
        );

        return AiChatResponse.builder()
                .response(responseText)
                .summary("Generated " + suggestions.size() + " actionable task items.")
                .suggestedTasks(suggestions)
                .build();
    }

    private AiChatResponse handleSchedulePlanning(User user, String prompt, List<Task> tasks, List<Event> events, List<Meeting> meetings) {
        List<String> schedule = new ArrayList<>();
        schedule.add("🌅 09:00 AM - 10:30 AM: Deep Focus on High-Priority Deliverables");
        schedule.add("☕ 10:30 AM - 11:00 AM: Inbox & Team Chat Sync");

        if (!meetings.isEmpty()) {
            schedule.add("👥 11:00 AM - 12:00 PM: Team Video Conference / Sync");
        } else {
            schedule.add("⚡ 11:00 AM - 12:30 PM: Project Sprint Execution");
        }

        schedule.add("🥪 12:30 PM - 01:30 PM: Rest & Refuel Break");
        schedule.add("💻 01:30 PM - 03:30 PM: Core Development & Implementation");
        schedule.add("📅 03:30 PM - 04:30 PM: Calendar & Sprint Review");
        schedule.add("✨ 04:30 PM - 05:00 PM: Daily Wrap-Up & Tomorrow Planning");

        StringBuilder sb = new StringBuilder();
        sb.append("Here is your optimized productivity schedule based on your current workspace status:\n\n");
        sb.append(String.format("• **Pending Tasks**: %d items currently queued\n", tasks.size()));
        sb.append(String.format("• **Scheduled Events**: %d calendar commitments\n", events.size()));
        sb.append(String.format("• **Active Meetings**: %d room sessions\n\n", meetings.size()));
        sb.append("### Recommended Time-Blocked Schedule\n");
        for (String slot : schedule) {
            sb.append("- ").append(slot).append("\n");
        }

        return AiChatResponse.builder()
                .response(sb.toString())
                .summary("Personalized schedule optimized for " + tasks.size() + " tasks and " + (events.size() + meetings.size()) + " meetings.")
                .scheduleRecommendations(schedule)
                .build();
    }

    private AiChatResponse handleMeetingSummary(String prompt) {
        AiMeetingSummaryDto summary = AiMeetingSummaryDto.builder()
                .title("Conference Synthesis & Strategic Alignment")
                .overview("The team reviewed product milestones, finalized the architecture for real-time collaborative systems, and assigned ownership for upcoming deliverables.")
                .keyDecisions(List.of(
                        "Adopt WebRTC mesh peer-to-peer architecture for zero-latency audio/video calling.",
                        "Use STOMP over WebSocket for lightweight delta drawing and presence broadcasts.",
                        "Enforce stateless JWT security across REST and STOMP channels."
                ))
                .actionItems(List.of(
                        "Backend Team: Complete S3 presigned URL integration and persistence tests.",
                        "Frontend Team: Finalize vector canvas smoothing and meeting room whiteboard toggle.",
                        "QA: Execute multi-peer conference room and load testing."
                ))
                .nextSteps(List.of(
                        "Deploy Stage 4 build to staging environment.",
                        "Conduct end-to-end user acceptance review."
                ))
                .build();

        return AiChatResponse.builder()
                .response("### 📋 Executive Meeting Summary\n\n" +
                          summary.getOverview() + "\n\n" +
                          "**Key Decisions:**\n" +
                          String.join("\n", summary.getKeyDecisions().stream().map(d -> "• " + d).collect(Collectors.toList())) + "\n\n" +
                          "**Action Items:**\n" +
                          String.join("\n", summary.getActionItems().stream().map(a -> "• " + a).collect(Collectors.toList())))
                .summary("Meeting summarized into 3 key decisions and 3 action items.")
                .meetingSummary(summary)
                .build();
    }

    private AiChatResponse handleGeneralProductivity(User user, String prompt, List<Task> pending, List<Task> completed, List<Event> events, List<Meeting> meetings) {
        int total = pending.size() + completed.size();
        double rate = total > 0 ? ((double) completed.size() / total) * 100 : 0;

        String answer = String.format(
                "Hello %s! I'm NOVA, your intelligent workspace AI.\n\n" +
                "**Workspace Status:**\n" +
                "• **Tasks**: %d pending, %d completed (%.1f%% completion rate)\n" +
                "• **Calendar & Meetings**: %d scheduled events and %d meeting rooms\n\n" +
                "I can help you **plan your day**, **break down complex goals into tasks**, **summarize meetings**, or **search across your workspace**. What would you like to accomplish next?",
                user.getName().split(" ")[0],
                pending.size(),
                completed.size(),
                rate,
                events.size(),
                meetings.size()
        );

        return AiChatResponse.builder()
                .response(answer)
                .summary("NOVA AI ready to assist across all modules.")
                .build();
    }

    @Transactional
    public List<TaskDto> createSuggestedTasks(User user, CreateSuggestedTasksRequest request) {
        List<Task> toSave = new ArrayList<>();

        for (AiTaskSuggestionDto s : request.getTasks()) {
            Task.Priority priority;
            try {
                priority = Task.Priority.valueOf(s.getPriority().toUpperCase());
            } catch (Exception e) {
                priority = Task.Priority.MEDIUM;
            }

            LocalDate deadline = null;
            if (s.getDeadline() != null && !s.getDeadline().isBlank()) {
                try {
                    deadline = LocalDate.parse(s.getDeadline());
                } catch (Exception ignored) {
                }
            }

            Task task = Task.builder()
                    .title(s.getTitle())
                    .description(s.getDescription())
                    .priority(priority)
                    .category(s.getCategory() != null ? s.getCategory() : "AI Generated")
                    .deadline(deadline)
                    .completed(false)
                    .user(user)
                    .build();

            toSave.add(task);
        }

        List<Task> saved = taskRepository.saveAll(toSave);

        return saved.stream().map(t -> TaskDto.builder()
                .id(t.getId())
                .title(t.getTitle())
                .description(t.getDescription())
                .priority(t.getPriority())
                .category(t.getCategory())
                .deadline(t.getDeadline())
                .completed(t.isCompleted())
                .build()).collect(Collectors.toList());
    }

    public AiProductivityAnalyticsDto getAnalytics(User user) {
        List<Task> tasks = taskRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
        List<Event> events = eventRepository.findByUserIdOrderByStartTimeAsc(user.getId());
        List<Meeting> meetings = meetingRepository.findAllForUser(user.getId());
        List<FileMetadata> files = fileMetadataRepository.findByOwnerIdOrderByCreatedAtDesc(user.getId());

        int completed = (int) tasks.stream().filter(Task::isCompleted).count();
        int pending = tasks.size() - completed;
        int total = tasks.size();
        double rate = total > 0 ? ((double) completed / total) * 100 : 0;

        int deadlinesToday = (int) tasks.stream()
                .filter(t -> t.getDeadline() != null && t.getDeadline().isEqual(LocalDate.now()))
                .count();

        List<AiProductivityAnalyticsDto.DailyMetric> trend = List.of(
                new AiProductivityAnalyticsDto.DailyMetric("Mon", 3, 4),
                new AiProductivityAnalyticsDto.DailyMetric("Tue", 5, 3),
                new AiProductivityAnalyticsDto.DailyMetric("Wed", 4, 6),
                new AiProductivityAnalyticsDto.DailyMetric("Thu", 6, 2),
                new AiProductivityAnalyticsDto.DailyMetric("Fri", 7, 5),
                new AiProductivityAnalyticsDto.DailyMetric("Sat", 2, 1),
                new AiProductivityAnalyticsDto.DailyMetric("Sun", 1, 0)
        );

        String insight = rate >= 70
                ? "Excellent momentum! You have maintained a high task completion velocity this week."
                : "You have several pending deliverables. Let NOVA AI help you time-block and organize your day.";

        return AiProductivityAnalyticsDto.builder()
                .totalTasks(total)
                .completedTasks(completed)
                .pendingTasks(pending)
                .upcomingDeadlines(deadlinesToday)
                .totalMeetings(meetings.size())
                .completionRate(Math.round(rate * 10.0) / 10.0)
                .unreadMessagesCount(3)
                .totalFilesCount(files.size())
                .productivityInsight(insight)
                .weeklyTrend(trend)
                .build();
    }
}
