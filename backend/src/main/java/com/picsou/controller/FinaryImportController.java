package com.picsou.controller;

import com.picsou.dto.FinaryImportRequest;
import com.picsou.dto.FinaryImportResultResponse;
import com.picsou.dto.FinaryPreviewResponse;
import com.picsou.service.FinaryImportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/finary")
@RequiredArgsConstructor
public class FinaryImportController {

    private final FinaryImportService finaryImportService;

    @PostMapping(value = "/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public FinaryPreviewResponse preview(@RequestParam("file") MultipartFile file) {
        return finaryImportService.preview(file);
    }

    @PostMapping("/import")
    public FinaryImportResultResponse importData(@RequestBody FinaryImportRequest request) {
        return finaryImportService.executeImport(request);
    }
}
