package com.dms.processor.service.impl;

import com.dms.processor.service.OcrService;
import net.sourceforge.tess4j.Tesseract;
import net.sourceforge.tess4j.TesseractException;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.ExecutorService;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class OcrLargeFileProcessorTest {

    @Mock
    private OcrService ocrService;

    @Mock
    private ExecutorService executorService;

    @Spy
    @InjectMocks
    private OcrLargeFileProcessor ocrLargeFileProcessor;

    @TempDir
    Path tempDir;

    @BeforeEach
    public void setUp() {
        // Set private fields using ReflectionTestUtils
        ReflectionTestUtils.setField(ocrLargeFileProcessor, "chunkSize", 5);
        ReflectionTestUtils.setField(ocrLargeFileProcessor, "tempDir", tempDir.toString());
        ReflectionTestUtils.setField(ocrLargeFileProcessor, "maxThreads", 2);
        ReflectionTestUtils.setField(ocrLargeFileProcessor, "timeoutMinutes", 5);
        ReflectionTestUtils.setField(ocrLargeFileProcessor, "tessdataPath", "/usr/share/tesseract-ocr/5/tessdata");
        ReflectionTestUtils.setField(ocrLargeFileProcessor, "dpi", 300f);
        ReflectionTestUtils.setField(ocrLargeFileProcessor, "executorService", executorService);
    }

    @Test
    public void testProcessLargePdf_DirectTextExtraction() throws IOException, TesseractException {
        // Setup - create a valid dummy PDF file
        Path pdfPath = createDummyPdfFile();

        // Mock the OcrService to return a meaningful text - this will be considered sufficient
        // and avoid the image-based extraction path
        String expectedText = "This is sufficient text for direct extraction";
        when(ocrService.extractTextFromPdf(any(Path.class))).thenReturn(expectedText);

        // We need to modify the test approach because in the actual implementation,
        // extractPagesToImages is called before isTextSufficient is checked

        // Instead of trying to prevent extractPagesToImages from being called,
        // we'll mock it to do nothing and return expected data
        File mockTempDir = mock(File.class);
        doReturn(mockTempDir).when(ocrLargeFileProcessor).createTempDirectory();
        doReturn(new ArrayList<File>()).when(ocrLargeFileProcessor).extractPagesToImages(any(Path.class), any(File.class));

        // Make isTextSufficient return true so we take the direct extraction path
        doReturn(true).when(ocrLargeFileProcessor).isTextSufficient(anyString());

        // Execute
        String result = ocrLargeFileProcessor.processLargePdf(pdfPath);

        // Verify
        verify(ocrService).extractTextFromPdf(any(Path.class));
        assertNotNull(result);
        assertEquals(expectedText, result);
    }

    @Test
    public void testProcessLargePdf_WithImageExtraction() throws IOException, TesseractException {
        // Setup - create a valid dummy PDF file
        Path pdfPath = createDummyPdfFile();

        // Mock the OcrService to return insufficient text to force image-based OCR path
        when(ocrService.extractTextFromPdf(any(Path.class))).thenReturn("short");

        // Make isTextSufficient return false to force the image-based OCR path
        doReturn(false).when(ocrLargeFileProcessor).isTextSufficient(anyString());

        // Mock the createTempDirectory method
        File mockTempDir = new File(tempDir.toFile(), "ocr-temp");
        mockTempDir.mkdir();
        doReturn(mockTempDir).when(ocrLargeFileProcessor).createTempDirectory();

        // Mock the extractPagesToImages method
        List<File> mockImageFiles = createMockImageFiles(mockTempDir);
        doReturn(mockImageFiles).when(ocrLargeFileProcessor).extractPagesToImages(any(Path.class), any(File.class));

        // Mock the processPageImagesInChunks method
        String expectedResult = "OCR extracted text from images";
        doReturn(expectedResult).when(ocrLargeFileProcessor).processPageImagesInChunks(anyList(), anyInt());

        // Execute
        String result = ocrLargeFileProcessor.processLargePdf(pdfPath);

        // Verify
        verify(ocrService).extractTextFromPdf(any(Path.class));
        verify(ocrLargeFileProcessor).extractPagesToImages(any(Path.class), any(File.class));
        verify(ocrLargeFileProcessor).processPageImagesInChunks(eq(mockImageFiles), eq(mockImageFiles.size()));

        assertNotNull(result);
        assertEquals(expectedResult, result);
    }

    @Test
    public void testShutdown() throws InterruptedException {
        // Test the shutdown method
        when(executorService.awaitTermination(anyLong(), any(TimeUnit.class))).thenReturn(true);

        ocrLargeFileProcessor.shutdown();

        verify(executorService).shutdown();
        verify(executorService).awaitTermination(30, TimeUnit.SECONDS);
        verify(executorService, never()).shutdownNow();
    }

    @Test
    public void testShutdownWithTimeout() throws InterruptedException {
        // Test shutdown when awaiting termination times out
        when(executorService.awaitTermination(anyLong(), any(TimeUnit.class))).thenReturn(false);

        ocrLargeFileProcessor.shutdown();

        verify(executorService).shutdown();
        verify(executorService).awaitTermination(30, TimeUnit.SECONDS);
        verify(executorService).shutdownNow();
    }

    @Test
    public void testShutdownWithInterruption() throws InterruptedException {
        // Test shutdown when awaiting termination is interrupted
        when(executorService.awaitTermination(anyLong(), any(TimeUnit.class))).thenThrow(InterruptedException.class);

        ocrLargeFileProcessor.shutdown();

        verify(executorService).shutdown();
        verify(executorService).awaitTermination(30, TimeUnit.SECONDS);
        verify(executorService).shutdownNow();
        assertTrue(Thread.currentThread().isInterrupted());
    }

    @Test
    public void testCreateTempDirectory() throws IOException {
        // Set a dedicated test temp dir to avoid conflicts with other tests
        ReflectionTestUtils.setField(ocrLargeFileProcessor, "tempDir", tempDir.toString());

        // We need to use reflection to call private method
        File result = null;
        try {
            // Get the private method
            java.lang.reflect.Method method = OcrLargeFileProcessor.class.getDeclaredMethod("createTempDirectory");
            method.setAccessible(true);

            // Invoke the method
            result = (File) method.invoke(ocrLargeFileProcessor);
        } catch (Exception e) {
            fail("Exception invoking createTempDirectory: " + e.getMessage());
        }

        assertNotNull(result);
        assertTrue(result.exists());
        assertTrue(result.isDirectory());
        assertTrue(result.getPath().startsWith(tempDir.toString()));
    }

    @Test
    public void testCleanupTempDirectory() throws IOException {
        // Create a temporary directory with some files
        File testDir = new File(tempDir.toFile(), "test-cleanup");
        testDir.mkdir();
        File testFile = new File(testDir, "test.txt");
        testFile.createNewFile();

        try {
            // Get the private method
            java.lang.reflect.Method method = OcrLargeFileProcessor.class.getDeclaredMethod("cleanupTempDirectory", File.class);
            method.setAccessible(true);

            // Invoke the method
            method.invoke(ocrLargeFileProcessor, testDir);
        } catch (Exception e) {
            fail("Exception invoking cleanupTempDirectory: " + e.getMessage());
        }

        // Verify that files and directory were deleted
        assertFalse(testFile.exists());
        assertFalse(testDir.exists());
    }

    @Test
    public void testIsTextSufficient() {
        try {
            // Get the private method
            java.lang.reflect.Method method = OcrLargeFileProcessor.class.getDeclaredMethod("isTextSufficient", String.class);
            method.setAccessible(true);

            // Test with sufficient text
            boolean result1 = (boolean) method.invoke(ocrLargeFileProcessor,
                    "This is a sufficiently long text that should pass the check because it has more than 100 recognizable characters.");
            assertTrue(result1);

            // Test with insufficient text
            boolean result2 = (boolean) method.invoke(ocrLargeFileProcessor, "Short text");
            assertFalse(result2);

            // Test with null
            boolean result3 = (boolean) method.invoke(ocrLargeFileProcessor, (String)null);
            assertFalse(result3);

            // Test with empty string
            boolean result4 = (boolean) method.invoke(ocrLargeFileProcessor, "");
            assertFalse(result4);
        } catch (Exception e) {
            fail("Exception invoking isTextSufficient: " + e.getMessage());
        }
    }

    // Helper methods

    private Path createDummyPdfFile() throws IOException {
        Path pdfPath = tempDir.resolve("test.pdf");

        // Create a minimal valid PDF file instead of an empty file
        // This is just enough bytes to make PDFBox recognize it as a PDF
        try (FileOutputStream fos = new FileOutputStream(pdfPath.toFile())) {
            // PDF header and a minimal PDF structure
            String pdfContent =
                    "%PDF-1.4\n" +
                    "1 0 obj\n" +
                    "<</Type /Catalog /Pages 2 0 R>>\n" +
                    "endobj\n" +
                    "2 0 obj\n" +
                    "<</Type /Pages /Kids [3 0 R] /Count 1>>\n" +
                    "endobj\n" +
                    "3 0 obj\n" +
                    "<</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R>>\n" +
                    "endobj\n" +
                    "4 0 obj\n" +
                    "<</Length 10>>\n" +
                    "stream\n" +
                    "BT /F1 12 Tf 100 700 Td (Test PDF) Tj ET\n" +
                    "endstream\n" +
                    "endobj\n" +
                    "xref\n" +
                    "0 5\n" +
                    "0000000000 65535 f\n" +
                    "0000000010 00000 n\n" +
                    "0000000053 00000 n\n" +
                    "0000000102 00000 n\n" +
                    "0000000183 00000 n\n" +
                    "trailer <</Size 5 /Root 1 0 R>>\n" +
                    "startxref\n" +
                    "284\n" +
                    "%%EOF";

            fos.write(pdfContent.getBytes());
        }

        return pdfPath;
    }

    private void createDummyImageFile(File file) throws IOException {
        BufferedImage img = new BufferedImage(100, 100, BufferedImage.TYPE_INT_RGB);
        ImageIO.write(img, "PNG", file);
    }

    private List<File> createMockImageFiles(File tempDirectory) throws IOException {
        // Create and return dummy image files to simulate the extracted pages
        File page0 = new File(tempDirectory, "page_0.png");
        File page1 = new File(tempDirectory, "page_1.png");
        createDummyImageFile(page0);
        createDummyImageFile(page1);
        return Arrays.asList(page0, page1);
    }
}