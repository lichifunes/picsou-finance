package com.picsou.controller;

import com.picsou.config.FinaryProperties;
import com.picsou.dto.FinaryApiSyncExecuteRequest;
import com.picsou.dto.FinaryImportResultResponse;
import com.picsou.dto.FinaryPreviewResponse;
import com.picsou.finary.FinaryApiSyncService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * Controller for Finary API direct sync (two-phase: preview + execute)
 */
@RestController
@RequestMapping("/api/finary")
@RequiredArgsConstructor
public class FinaryApiSyncController {

    private final FinaryApiSyncService finaryApiSyncService;
    private final FinaryProperties finaryProperties;

    /**
     * Check if Finary API sync is configured
     */
    @GetMapping("/configured")
    public boolean isConfigured() {
        String email = finaryProperties.getEmail();
        String password = finaryProperties.getPassword();
        return email != null && !email.isBlank() && password != null && !password.isBlank();
    }

    /**
     * Preview phase: authenticate, fetch accounts + transactions, return preview for mapping
     */
    @PostMapping("/api-sync/preview")
    public FinaryPreviewResponse apiSyncPreview(@RequestParam(required = false) String totp) {
        return finaryApiSyncService.preview(totp);
    }

    /**
     * Execute phase: apply user mappings and import accounts + transactions
     */
    @PostMapping("/api-sync/execute")
    public FinaryImportResultResponse apiSyncExecute(@RequestBody FinaryApiSyncExecuteRequest request) {
        return finaryApiSyncService.execute(request.syncToken(), request.mappings());
    }
}
