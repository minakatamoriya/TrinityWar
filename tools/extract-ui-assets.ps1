param(
    [Parameter(Mandatory = $true)]
    [string]$InputImage,

    [Parameter(Mandatory = $true)]
    [string]$OutputDir,

    [int]$TargetSize = 64,
    [int]$WhiteThreshold = 245,
    [int]$MinPixels = 180,
    [int]$Padding = 8,
    [int]$MergeGap = 10
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies @("System.Drawing") -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public sealed class ComponentInfo
{
    public Rectangle Bounds { get; private set; }
    public int Pixels { get; private set; }

    public ComponentInfo(Rectangle bounds, int pixels)
    {
        Bounds = bounds;
        Pixels = pixels;
    }
}

public sealed class FastBitmapMask : IDisposable
{
    private readonly Bitmap workingBitmap;
    private readonly byte[] sourceBytes;
    private readonly bool[] nonWhiteMask;

    public int Width { get; private set; }
    public int Height { get; private set; }
    public int Stride { get; private set; }

    public FastBitmapMask(Bitmap sourceBitmap, int whiteThreshold)
    {
        Width = sourceBitmap.Width;
        Height = sourceBitmap.Height;
        workingBitmap = new Bitmap(Width, Height, PixelFormat.Format32bppArgb);

        using (Graphics graphics = Graphics.FromImage(workingBitmap))
        {
            graphics.DrawImage(sourceBitmap, 0, 0, Width, Height);
        }

        Rectangle rect = new Rectangle(0, 0, Width, Height);
        BitmapData bitmapData = workingBitmap.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        try
        {
            Stride = Math.Abs(bitmapData.Stride);
            sourceBytes = new byte[Stride * Height];
            Marshal.Copy(bitmapData.Scan0, sourceBytes, 0, sourceBytes.Length);
        }
        finally
        {
            workingBitmap.UnlockBits(bitmapData);
        }

        nonWhiteMask = new bool[Width * Height];
        for (int y = 0; y < Height; y++)
        {
            int rowOffset = y * Stride;
            int maskRowOffset = y * Width;
            for (int x = 0; x < Width; x++)
            {
                int pixelOffset = rowOffset + (x * 4);
                byte b = sourceBytes[pixelOffset];
                byte g = sourceBytes[pixelOffset + 1];
                byte r = sourceBytes[pixelOffset + 2];
                byte a = sourceBytes[pixelOffset + 3];
                nonWhiteMask[maskRowOffset + x] = a > 0 && (r < whiteThreshold || g < whiteThreshold || b < whiteThreshold);
            }
        }
    }

    public List<ComponentInfo> FindComponents(int minPixels)
    {
        bool[] visited = new bool[nonWhiteMask.Length];
        int[] queue = new int[nonWhiteMask.Length];
        List<ComponentInfo> components = new List<ComponentInfo>();

        for (int index = 0; index < nonWhiteMask.Length; index++)
        {
            if (visited[index])
            {
                continue;
            }

            visited[index] = true;
            if (!nonWhiteMask[index])
            {
                continue;
            }

            int head = 0;
            int tail = 0;
            queue[tail++] = index;

            int minX = index % Width;
            int minY = index / Width;
            int maxX = minX;
            int maxY = minY;
            int pixelCount = 0;

            while (head < tail)
            {
                int current = queue[head++];
                int x = current % Width;
                int y = current / Width;

                pixelCount++;
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;

                if (x > 0)
                {
                    int left = current - 1;
                    if (!visited[left])
                    {
                        visited[left] = true;
                        if (nonWhiteMask[left]) queue[tail++] = left;
                    }
                }

                if (x < Width - 1)
                {
                    int right = current + 1;
                    if (!visited[right])
                    {
                        visited[right] = true;
                        if (nonWhiteMask[right]) queue[tail++] = right;
                    }
                }

                if (y > 0)
                {
                    int up = current - Width;
                    if (!visited[up])
                    {
                        visited[up] = true;
                        if (nonWhiteMask[up]) queue[tail++] = up;
                    }
                }

                if (y < Height - 1)
                {
                    int down = current + Width;
                    if (!visited[down])
                    {
                        visited[down] = true;
                        if (nonWhiteMask[down]) queue[tail++] = down;
                    }
                }
            }

            if (pixelCount >= minPixels)
            {
                Rectangle bounds = Rectangle.FromLTRB(minX, minY, maxX + 1, maxY + 1);
                components.Add(new ComponentInfo(bounds, pixelCount));
            }
        }

        return components;
    }

    public Bitmap CreateTransparentCrop(Rectangle rect)
    {
        Bitmap output = new Bitmap(rect.Width, rect.Height, PixelFormat.Format32bppArgb);
        Rectangle outputRect = new Rectangle(0, 0, output.Width, output.Height);
        BitmapData outputData = output.LockBits(outputRect, ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);

        try
        {
            int outputStride = Math.Abs(outputData.Stride);
            byte[] outputBytes = new byte[outputStride * output.Height];

            for (int y = 0; y < rect.Height; y++)
            {
                int sourceRowOffset = (rect.Y + y) * Stride;
                int outputRowOffset = y * outputStride;
                int maskRowOffset = (rect.Y + y) * Width;

                for (int x = 0; x < rect.Width; x++)
                {
                    int sourceX = rect.X + x;
                    int maskIndex = maskRowOffset + sourceX;
                    if (!nonWhiteMask[maskIndex])
                    {
                        continue;
                    }

                    int sourcePixelOffset = sourceRowOffset + (sourceX * 4);
                    int outputPixelOffset = outputRowOffset + (x * 4);
                    outputBytes[outputPixelOffset] = sourceBytes[sourcePixelOffset];
                    outputBytes[outputPixelOffset + 1] = sourceBytes[sourcePixelOffset + 1];
                    outputBytes[outputPixelOffset + 2] = sourceBytes[sourcePixelOffset + 2];
                    outputBytes[outputPixelOffset + 3] = sourceBytes[sourcePixelOffset + 3];
                }
            }

            Marshal.Copy(outputBytes, 0, outputData.Scan0, outputBytes.Length);
        }
        finally
        {
            output.UnlockBits(outputData);
        }

        return output;
    }

    public void Dispose()
    {
        workingBitmap.Dispose();
    }
}
"@

function Expand-Rectangle {
    param(
        [System.Drawing.Rectangle]$Rect,
        [int]$Amount,
        [int]$MaxWidth,
        [int]$MaxHeight
    )

    $x = [Math]::Max(0, $Rect.X - $Amount)
    $y = [Math]::Max(0, $Rect.Y - $Amount)
    $right = [Math]::Min($MaxWidth, $Rect.Right + $Amount)
    $bottom = [Math]::Min($MaxHeight, $Rect.Bottom + $Amount)
    return [System.Drawing.Rectangle]::FromLTRB($x, $y, $right, $bottom)
}

function Rectangles-TouchOrOverlap {
    param(
        [System.Drawing.Rectangle]$A,
        [System.Drawing.Rectangle]$B,
        [int]$Gap
    )

    $expanded = [System.Drawing.Rectangle]::FromLTRB(
        $A.Left - $Gap,
        $A.Top - $Gap,
        $A.Right + $Gap,
        $A.Bottom + $Gap
    )

    return $expanded.IntersectsWith($B)
}

function Merge-Rectangles {
    param(
        [System.Collections.Generic.List[object]]$Rects,
        [int]$Gap
    )

    $merged = New-Object 'System.Collections.Generic.List[object]'

    foreach ($rectInfo in $Rects) {
        $current = $rectInfo
        $didMerge = $true

        while ($didMerge) {
            $didMerge = $false
            for ($i = $merged.Count - 1; $i -ge 0; $i--) {
                $candidate = $merged[$i]
                if (Rectangles-TouchOrOverlap -A $current.Bounds -B $candidate.Bounds -Gap $Gap) {
                    $union = [System.Drawing.Rectangle]::Union($current.Bounds, $candidate.Bounds)
                    $current = [pscustomobject]@{
                        Bounds = $union
                        Pixels = $current.Pixels + $candidate.Pixels
                    }
                    $merged.RemoveAt($i)
                    $didMerge = $true
                }
            }
        }

        $merged.Add($current)
    }

    return $merged
}

if (-not (Test-Path -LiteralPath $InputImage)) {
    throw "Input image not found: $InputImage"
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$rawDir = Join-Path $OutputDir "raw"
$scaledDir = Join-Path $OutputDir "scaled-64"
New-Item -ItemType Directory -Force -Path $rawDir | Out-Null
New-Item -ItemType Directory -Force -Path $scaledDir | Out-Null

$bitmap = [System.Drawing.Bitmap]::new($InputImage)
$fastBitmapMask = $null

try {
    $width = $bitmap.Width
    $height = $bitmap.Height
    $components = New-Object 'System.Collections.Generic.List[object]'

    $fastBitmapMask = [FastBitmapMask]::new($bitmap, $WhiteThreshold)
    foreach ($componentInfo in $fastBitmapMask.FindComponents($MinPixels)) {
        $components.Add([pscustomobject]@{
            Bounds = $componentInfo.Bounds
            Pixels = $componentInfo.Pixels
        })
    }

    $mergedComponents = Merge-Rectangles -Rects $components -Gap $MergeGap |
        Sort-Object { $_.Bounds.Y }, { $_.Bounds.X }

    $manifest = New-Object 'System.Collections.Generic.List[object]'
    $index = 1

    foreach ($component in $mergedComponents) {
        $bounds = Expand-Rectangle -Rect $component.Bounds -Amount $Padding -MaxWidth $width -MaxHeight $height

        $rawBitmap = $fastBitmapMask.CreateTransparentCrop($bounds)
        try {
            $scaledBitmap = [System.Drawing.Bitmap]::new($TargetSize, $TargetSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
            try {
                $graphics = [System.Drawing.Graphics]::FromImage($scaledBitmap)
                try {
                    $graphics.Clear([System.Drawing.Color]::Transparent)
                    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
                    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

                    $scale = [Math]::Min($TargetSize / [double]$bounds.Width, $TargetSize / [double]$bounds.Height)
                    $drawWidth = [int][Math]::Round($bounds.Width * $scale)
                    $drawHeight = [int][Math]::Round($bounds.Height * $scale)
                    $drawX = [int][Math]::Floor(($TargetSize - $drawWidth) / 2)
                    $drawY = [int][Math]::Floor(($TargetSize - $drawHeight) / 2)

                    $graphics.DrawImage($rawBitmap, $drawX, $drawY, $drawWidth, $drawHeight)
                }
                finally {
                    $graphics.Dispose()
                }

                $baseName = ("asset_{0:D2}" -f $index)
                $rawPath = Join-Path $rawDir ($baseName + ".png")
                $scaledPath = Join-Path $scaledDir ($baseName + ".png")

                $rawBitmap.Save($rawPath, [System.Drawing.Imaging.ImageFormat]::Png)
                $scaledBitmap.Save($scaledPath, [System.Drawing.Imaging.ImageFormat]::Png)

                $scaledSize = (Get-Item -LiteralPath $scaledPath).Length
                $manifest.Add([pscustomobject]@{
                    Name = $baseName
                    SourceX = $bounds.X
                    SourceY = $bounds.Y
                    Width = $bounds.Width
                    Height = $bounds.Height
                    Pixels = $component.Pixels
                    FileSizeBytes = $scaledSize
                })

                $index++
            }
            finally {
                $scaledBitmap.Dispose()
            }
        }
        finally {
            $rawBitmap.Dispose()
        }
    }

    $manifestPath = Join-Path $OutputDir "manifest.csv"
    $manifest | Export-Csv -NoTypeInformation -Encoding UTF8 -LiteralPath $manifestPath

    Write-Output ("Exported {0} assets to {1}" -f $manifest.Count, $OutputDir)
}
finally {
    if ($null -ne $fastBitmapMask) {
        $fastBitmapMask.Dispose()
    }
    $bitmap.Dispose()
}
