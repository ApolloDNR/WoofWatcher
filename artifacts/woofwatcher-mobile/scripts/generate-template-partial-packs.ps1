$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$script:TemplateIds = @("retriever", "husky", "doodle")
$script:Root = Split-Path -Parent $PSScriptRoot
$script:TemplateRoot = Join-Path $script:Root "assets\avatar\templates"
$script:CanvasSize = 170

function Get-TemplateBounds {
  param(
    [Parameter(Mandatory = $true)]
    [System.Drawing.Bitmap]$Bitmap
  )

  $minX = $Bitmap.Width
  $minY = $Bitmap.Height
  $maxX = -1
  $maxY = -1

  for ($x = 0; $x -lt $Bitmap.Width; $x++) {
    for ($y = 0; $y -lt $Bitmap.Height; $y++) {
      $pixel = $Bitmap.GetPixel($x, $y)
      if ($pixel.A -gt 0) {
        if ($x -lt $minX) { $minX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }

  if ($maxX -lt 0 -or $maxY -lt 0) {
    throw "Could not find opaque pixels in base art."
  }

  return [pscustomobject]@{
    Left   = $minX
    Top    = $minY
    Right  = $maxX
    Bottom = $maxY
    Width  = ($maxX - $minX + 1)
    Height = ($maxY - $minY + 1)
    CenterX = [int](($minX + $maxX) / 2)
    HeadY   = $minY + [int](($maxY - $minY) * 0.18)
    NeckY   = $minY + [int](($maxY - $minY) * 0.46)
    ChestY  = $minY + [int](($maxY - $minY) * 0.58)
  }
}

function New-Canvas {
  $bitmap = [System.Drawing.Bitmap]::new($script:CanvasSize, $script:CanvasSize)
  $bitmap.MakeTransparent()
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half

  return [pscustomobject]@{
    Bitmap = $bitmap
    Graphics = $graphics
  }
}

function Save-Canvas {
  param(
    [Parameter(Mandatory = $true)]$Canvas,
    [Parameter(Mandatory = $true)][string]$Path
  )

  $dir = Split-Path -Parent $Path
  if (-not (Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir | Out-Null
  }

  $Canvas.Bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $Canvas.Graphics.Dispose()
  $Canvas.Bitmap.Dispose()
}

function Draw-Bandana {
  param($Graphics, $Bounds, [System.Drawing.Color]$Color)

  $points = [System.Drawing.Point[]]@(
    [System.Drawing.Point]::new($Bounds.CenterX - 22, $Bounds.NeckY - 1),
    [System.Drawing.Point]::new($Bounds.CenterX + 22, $Bounds.NeckY - 1),
    [System.Drawing.Point]::new($Bounds.CenterX + 12, $Bounds.NeckY + 9),
    [System.Drawing.Point]::new($Bounds.CenterX + 2, $Bounds.NeckY + 17),
    [System.Drawing.Point]::new($Bounds.CenterX - 10, $Bounds.NeckY + 9)
  )
  $brush = [System.Drawing.SolidBrush]::new($Color)
  $Graphics.FillPolygon($brush, $points)
  $brush.Dispose()
}

function Draw-Collar {
  param($Graphics, $Bounds, [System.Drawing.Color]$Color, [switch]$Copper)

  $pen = [System.Drawing.Pen]::new($Color, 5)
  $Graphics.DrawArc($pen, $Bounds.CenterX - 24, $Bounds.NeckY - 7, 48, 20, 200, 140)
  $pen.Dispose()

  if ($Copper) {
    $tagBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 217, 126, 67))
    $Graphics.FillEllipse($tagBrush, $Bounds.CenterX + 8, $Bounds.NeckY + 4, 7, 7)
    $tagBrush.Dispose()
  }
}

function Draw-HeartTag {
  param($Graphics, $Bounds)

  $brush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 201, 99, 88))
  $Graphics.FillEllipse($brush, $Bounds.CenterX + 5, $Bounds.NeckY + 4, 6, 6)
  $Graphics.FillEllipse($brush, $Bounds.CenterX + 10, $Bounds.NeckY + 4, 6, 6)
  $points = [System.Drawing.Point[]]@(
    [System.Drawing.Point]::new($Bounds.CenterX + 4, $Bounds.NeckY + 8),
    [System.Drawing.Point]::new($Bounds.CenterX + 13, $Bounds.NeckY + 17),
    [System.Drawing.Point]::new($Bounds.CenterX + 22, $Bounds.NeckY + 8)
  )
  $Graphics.FillPolygon($brush, $points)
  $brush.Dispose()
}

function Draw-BirthdayHat {
  param($Graphics, $Bounds, [string]$TemplateId)

  $hatX = $Bounds.CenterX - 12
  if ($TemplateId -eq "doodle") { $hatX -= 2 }
  if ($TemplateId -eq "husky") { $hatX += 1 }
  $hatY = $Bounds.Top + 4

  $orange = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 224, 122, 47))
  $points = [System.Drawing.Point[]]@(
    [System.Drawing.Point]::new($hatX, $hatY + 18),
    [System.Drawing.Point]::new($hatX + 12, $hatY),
    [System.Drawing.Point]::new($hatX + 24, $hatY + 18)
  )
  $Graphics.FillPolygon($orange, $points)
  $orange.Dispose()

  $stripePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 255, 249, 239), 2)
  $Graphics.DrawLine($stripePen, $hatX + 7, $hatY + 14, $hatX + 12, $hatY + 2)
  $Graphics.DrawLine($stripePen, $hatX + 16, $hatY + 14, $hatX + 14, $hatY + 5)
  $stripePen.Dispose()

  $pom = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 216, 168, 82))
  $Graphics.FillEllipse($pom, $hatX + 9, $hatY - 4, 8, 8)
  $pom.Dispose()
}

function Draw-CozyBed {
  param($Graphics, $Bounds)

  $baseBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 229, 210, 196))
  $rimBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 204, 172, 142))
  $shadowBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(130, 129, 92, 66))

  $Graphics.FillEllipse($shadowBrush, $Bounds.CenterX - 44, $Bounds.Bottom - 8, 88, 18)
  $Graphics.FillEllipse($rimBrush, $Bounds.CenterX - 42, $Bounds.Bottom - 20, 84, 28)
  $Graphics.FillEllipse($baseBrush, $Bounds.CenterX - 32, $Bounds.Bottom - 16, 64, 18)

  $shadowBrush.Dispose()
  $rimBrush.Dispose()
  $baseBrush.Dispose()
}

function Draw-Sparkles {
  param($Graphics, $Bounds)

  $heart = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 201, 99, 88))
  foreach ($offset in @(
    @{ X = -24; Y = -8; Size = 8 },
    @{ X = 22; Y = -4; Size = 6 },
    @{ X = 30; Y = 18; Size = 5 }
  )) {
    $x = $Bounds.CenterX + $offset.X
    $y = $Bounds.HeadY + $offset.Y
    $size = $offset.Size
    $Graphics.FillEllipse($heart, $x, $y, $size, $size)
    $Graphics.FillEllipse($heart, $x + ($size / 2), $y, $size, $size)
    $points = [System.Drawing.Point[]]@(
      [System.Drawing.Point]::new($x - 1, $y + [int]($size / 2)),
      [System.Drawing.Point]::new($x + $size, $y + $size + 4),
      [System.Drawing.Point]::new($x + ($size * 2) + 1, $y + [int]($size / 2))
    )
    $Graphics.FillPolygon($heart, $points)
  }
  $heart.Dispose()
}

function Draw-Aura {
  param($Graphics, $Bounds, [System.Drawing.Color]$Color)

  $brush = [System.Drawing.SolidBrush]::new($Color)
  $Graphics.FillEllipse($brush, $Bounds.CenterX - 44, $Bounds.Top + 8, 88, 100)
  $brush.Dispose()
}

function Draw-Zzz {
  param($Graphics, $Bounds)

  $font = [System.Drawing.Font]::new("Segoe UI", 13, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $brush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 168, 203, 232))
  $Graphics.DrawString("Zzz", $font, $brush, $Bounds.CenterX + 10, $Bounds.Top + 2)
  $brush.Dispose()
  $font.Dispose()
}

function Draw-ExcitedStars {
  param($Graphics, $Bounds)

  $brush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 224, 122, 47))
  foreach ($point in @(
    @{ X = -30; Y = 10 },
    @{ X = 26; Y = 4 }
  )) {
    $x = $Bounds.CenterX + $point.X
    $y = $Bounds.Top + $point.Y
    $Graphics.FillRectangle($brush, $x + 3, $y, 2, 10)
    $Graphics.FillRectangle($brush, $x, $y + 3, 10, 2)
  }
  $brush.Dispose()
}

function Draw-HomeAloneBubble {
  param($Graphics, $Bounds)

  $bubbleBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(230, 255, 249, 239))
  $pen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 125, 164, 199), 2)
  $rect = [System.Drawing.Rectangle]::new($Bounds.CenterX + 12, $Bounds.Top + 4, 36, 20)
  $Graphics.FillEllipse($bubbleBrush, $rect)
  $Graphics.DrawEllipse($pen, $rect)
  $Graphics.DrawLine($pen, $Bounds.CenterX + 18, $Bounds.Top + 20, $Bounds.CenterX + 8, $Bounds.Top + 28)
  $bubbleBrush.Dispose()
  $pen.Dispose()
}

function Draw-NotFeelingWellMarker {
  param($Graphics, $Bounds)

  $pen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 201, 99, 88), 3)
  $Graphics.DrawLine($pen, $Bounds.CenterX + 16, $Bounds.Top + 18, $Bounds.CenterX + 28, $Bounds.Top + 10)
  $pen.Dispose()
  $brush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 201, 99, 88))
  $Graphics.FillEllipse($brush, $Bounds.CenterX + 24, $Bounds.Top + 6, 9, 9)
  $brush.Dispose()
}

function Draw-ProudRibbon {
  param($Graphics, $Bounds)

  $brush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 216, 168, 82))
  $Graphics.FillEllipse($brush, $Bounds.CenterX - 30, $Bounds.Top + 8, 16, 16)
  $Graphics.FillRectangle($brush, $Bounds.CenterX - 26, $Bounds.Top + 22, 4, 10)
  $Graphics.FillRectangle($brush, $Bounds.CenterX - 20, $Bounds.Top + 22, 4, 10)
  $brush.Dispose()
}

function New-AccessoryCanvas {
  param([System.Drawing.Bitmap]$BaseBitmap)
  $canvas = New-Canvas
  $canvas.Graphics.DrawImage($BaseBitmap, 0, 0, $script:CanvasSize, $script:CanvasSize)
  return $canvas
}

function Save-AccessoryAsset {
  param(
    [System.Drawing.Bitmap]$BaseBitmap,
    $Bounds,
    [string]$TemplateId,
    [string]$AccessoryId,
    [string]$Path
  )

  $canvas = New-Canvas

  switch ($AccessoryId) {
    "forest-bandana" { Draw-Bandana $canvas.Graphics $Bounds ([System.Drawing.Color]::FromArgb(255, 46, 88, 70)) }
    "trail-bandana" { Draw-Bandana $canvas.Graphics $Bounds ([System.Drawing.Color]::FromArgb(255, 109, 163, 111)) }
    "navy-collar" { Draw-Collar $canvas.Graphics $Bounds ([System.Drawing.Color]::FromArgb(255, 8, 20, 36)) }
    "copper-collar" { Draw-Collar $canvas.Graphics $Bounds ([System.Drawing.Color]::FromArgb(255, 204, 90, 42)) -Copper }
    "heart-tag" { Draw-HeartTag $canvas.Graphics $Bounds }
    "birthday-hat" { Draw-BirthdayHat $canvas.Graphics $Bounds $TemplateId }
    "cozy-bed" { Draw-CozyBed $canvas.Graphics $Bounds }
    "heart-sparkles" { Draw-Sparkles $canvas.Graphics $Bounds }
    default { throw "Unknown accessory $AccessoryId" }
  }

  Save-Canvas $canvas $Path
}

function Save-EmoteAsset {
  param(
    [System.Drawing.Bitmap]$BaseBitmap,
    $Bounds,
    [string]$EmoteId,
    [string]$Path
  )

  $canvas = New-AccessoryCanvas $BaseBitmap

  switch ($EmoteId) {
    "happy" {
      Draw-Aura $canvas.Graphics $Bounds ([System.Drawing.Color]::FromArgb(62, 216, 168, 82))
      Draw-Sparkles $canvas.Graphics $Bounds
    }
    "calm" {
      Draw-Aura $canvas.Graphics $Bounds ([System.Drawing.Color]::FromArgb(56, 109, 163, 111))
    }
    "excited" {
      Draw-Aura $canvas.Graphics $Bounds ([System.Drawing.Color]::FromArgb(70, 224, 122, 47))
      Draw-ExcitedStars $canvas.Graphics $Bounds
    }
    "sleepy" {
      Draw-Aura $canvas.Graphics $Bounds ([System.Drawing.Color]::FromArgb(44, 168, 203, 232))
      Draw-Zzz $canvas.Graphics $Bounds
    }
    "proud" {
      Draw-Aura $canvas.Graphics $Bounds ([System.Drawing.Color]::FromArgb(54, 216, 168, 82))
      Draw-ProudRibbon $canvas.Graphics $Bounds
    }
    "home_alone" {
      Draw-Aura $canvas.Graphics $Bounds ([System.Drawing.Color]::FromArgb(58, 168, 203, 232))
      Draw-HomeAloneBubble $canvas.Graphics $Bounds
    }
    "not_feeling_well" {
      Draw-Aura $canvas.Graphics $Bounds ([System.Drawing.Color]::FromArgb(64, 201, 99, 88))
      Draw-NotFeelingWellMarker $canvas.Graphics $Bounds
    }
    default { throw "Unknown emote $EmoteId" }
  }

  Save-Canvas $canvas $Path
}

foreach ($templateId in $script:TemplateIds) {
  $templatePath = Join-Path $script:TemplateRoot $templateId
  $basePath = Join-Path $templatePath "base.png"
  if (-not (Test-Path $basePath)) {
    throw "Missing base art for $templateId at $basePath"
  }

  $baseBitmap = [System.Drawing.Bitmap]::new($basePath)
  try {
    $bounds = Get-TemplateBounds -Bitmap $baseBitmap
    $accessoryDir = Join-Path $templatePath "accessories"
    $emoteDir = Join-Path $templatePath "emotes"

    foreach ($accessoryId in @(
      "forest-bandana",
      "trail-bandana",
      "navy-collar",
      "copper-collar",
      "heart-tag",
      "birthday-hat",
      "cozy-bed",
      "heart-sparkles"
    )) {
      Save-AccessoryAsset -BaseBitmap $baseBitmap -Bounds $bounds -TemplateId $templateId -AccessoryId $accessoryId -Path (Join-Path $accessoryDir "$accessoryId.png")
    }

    foreach ($emoteId in @(
      "happy",
      "calm",
      "excited",
      "sleepy",
      "proud",
      "home_alone",
      "not_feeling_well"
    )) {
      Save-EmoteAsset -BaseBitmap $baseBitmap -Bounds $bounds -EmoteId $emoteId -Path (Join-Path $emoteDir "$emoteId.png")
    }
  }
  finally {
    $baseBitmap.Dispose()
  }
}
