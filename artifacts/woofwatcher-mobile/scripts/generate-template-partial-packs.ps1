$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$script:TemplateIds = @("retriever", "husky", "bully", "doodle", "terrier", "hound", "dachshund", "spaniel", "toy", "slender", "mixed")
$script:Root = Split-Path -Parent $PSScriptRoot
$script:TemplateRoot = Join-Path $script:Root "assets\avatar\templates"
$script:CanvasSize = 170
$script:SpriteSlotSize = 256

$script:SpriteSpecs = @{
  "tail-wag" = @{ Frames = 8; Loop = $true }
  "ear-perk" = @{ Frames = 6; Loop = $false }
  "eat-loop" = @{ Frames = 8; Loop = $true }
  "sleep-loop" = @{ Frames = 8; Loop = $true }
  "comfort-loop" = @{ Frames = 8; Loop = $true }
  "celebrate-hop" = @{ Frames = 8; Loop = $false }
  "health-watch" = @{ Frames = 8; Loop = $true }
}

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
    Left = $minX
    Top = $minY
    Right = $maxX
    Bottom = $maxY
    Width = ($maxX - $minX + 1)
    Height = ($maxY - $minY + 1)
    CenterX = [int](($minX + $maxX) / 2)
    HeadY = $minY + [int](($maxY - $minY) * 0.18)
    NeckY = $minY + [int](($maxY - $minY) * 0.46)
    ChestY = $minY + [int](($maxY - $minY) * 0.58)
    BellyY = $minY + [int](($maxY - $minY) * 0.72)
  }
}

function New-Canvas {
  param([int]$Width = $script:CanvasSize, [int]$Height = $script:CanvasSize)

  $bitmap = [System.Drawing.Bitmap]::new($Width, $Height)
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

function Draw-SleepyMask {
  param($Graphics, $Bounds)

  $brush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(220, 168, 203, 232))
  $pen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 125, 164, 199), 2)
  $rect = [System.Drawing.Rectangle]::new($Bounds.CenterX - 24, $Bounds.HeadY + 4, 48, 16)
  $Graphics.FillEllipse($brush, $rect)
  $Graphics.DrawEllipse($pen, $rect)
  $Graphics.DrawLine($pen, $Bounds.CenterX - 30, $Bounds.HeadY + 10, $Bounds.CenterX - 18, $Bounds.HeadY + 8)
  $Graphics.DrawLine($pen, $Bounds.CenterX + 18, $Bounds.HeadY + 8, $Bounds.CenterX + 30, $Bounds.HeadY + 10)
  $pen.Dispose()
  $brush.Dispose()
}

function Draw-TrainingVest {
  param($Graphics, $Bounds)

  $brush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 216, 168, 82))
  $darkBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 129, 92, 66))
  $points = [System.Drawing.Point[]]@(
    [System.Drawing.Point]::new($Bounds.CenterX - 26, $Bounds.ChestY - 8),
    [System.Drawing.Point]::new($Bounds.CenterX + 24, $Bounds.ChestY - 8),
    [System.Drawing.Point]::new($Bounds.CenterX + 16, $Bounds.BellyY + 14),
    [System.Drawing.Point]::new($Bounds.CenterX - 18, $Bounds.BellyY + 14)
  )
  $Graphics.FillPolygon($brush, $points)
  $Graphics.FillRectangle($darkBrush, $Bounds.CenterX - 6, $Bounds.ChestY, 12, 6)
  $brush.Dispose()
  $darkBrush.Dispose()
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

function Draw-BoredMarker {
  param($Graphics, $Bounds)

  $pen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 142, 122, 99), 2)
  $Graphics.DrawArc($pen, $Bounds.CenterX + 16, $Bounds.Top + 8, 16, 16, 215, 220)
  $Graphics.DrawLine($pen, $Bounds.CenterX + 24, $Bounds.Top + 16, $Bounds.CenterX + 24, $Bounds.Top + 12)
  $Graphics.DrawLine($pen, $Bounds.CenterX + 24, $Bounds.Top + 16, $Bounds.CenterX + 28, $Bounds.Top + 19)
  $pen.Dispose()
}

function Draw-HungryBowl {
  param($Graphics, $Bounds)

  $bowlBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 201, 144, 82))
  $Graphics.FillPie($bowlBrush, $Bounds.CenterX + 16, $Bounds.Bottom - 38, 22, 14, 0, 180)
  $bowlBrush.Dispose()
}

function Draw-AnxiousMarker {
  param($Graphics, $Bounds)

  $pen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 125, 164, 199), 2)
  $Graphics.DrawArc($pen, $Bounds.CenterX + 20, $Bounds.Top + 8, 18, 18, 140, 260)
  $Graphics.DrawLine($pen, $Bounds.CenterX + 28, $Bounds.Top + 22, $Bounds.CenterX + 30, $Bounds.Top + 30)
  $pen.Dispose()
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

function Save-AccessoryAsset {
  param(
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
    "sleepy-mask" { Draw-SleepyMask $canvas.Graphics $Bounds }
    "training-vest" { Draw-TrainingVest $canvas.Graphics $Bounds }
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

  $canvas = New-Canvas
  $canvas.Graphics.DrawImage($BaseBitmap, 0, 0, $script:CanvasSize, $script:CanvasSize)

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
    "bored" {
      Draw-Aura $canvas.Graphics $Bounds ([System.Drawing.Color]::FromArgb(48, 142, 122, 99))
      Draw-BoredMarker $canvas.Graphics $Bounds
    }
    "hungry" {
      Draw-Aura $canvas.Graphics $Bounds ([System.Drawing.Color]::FromArgb(58, 201, 144, 82))
      Draw-HungryBowl $canvas.Graphics $Bounds
    }
    "anxious" {
      Draw-Aura $canvas.Graphics $Bounds ([System.Drawing.Color]::FromArgb(54, 168, 203, 232))
      Draw-AnxiousMarker $canvas.Graphics $Bounds
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

function Draw-SpriteFrame {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.Bitmap]$BaseBitmap,
    [int]$SlotIndex,
    [string]$Action,
    $Bounds
  )

  $slotLeft = $SlotIndex * $script:SpriteSlotSize
  $progress = if ($script:SpriteSpecs[$Action].Frames -le 1) { 0 } else { $SlotIndex / ($script:SpriteSpecs[$Action].Frames - 1) }
  $cycle = [Math]::Sin($progress * [Math]::PI * 2)
  $drawWidth = 194
  $drawHeight = 194
  $offsetX = 0
  $offsetY = 0

  switch ($Action) {
    "tail-wag" {
      $offsetX = [int]([Math]::Round($cycle * 4))
      $offsetY = [int]([Math]::Round([Math]::Abs($cycle) * -3))
    }
    "ear-perk" {
      $offsetY = if ($SlotIndex -lt 2) { -2 } elseif ($SlotIndex -lt 4) { -10 } else { -4 }
    }
    "eat-loop" {
      $offsetX = -4
      $offsetY = if ($SlotIndex % 2 -eq 0) { 6 } else { 11 }
    }
    "sleep-loop" {
      $drawWidth = 188
      $drawHeight = 188
      $offsetY = 12 + [int]([Math]::Round(([Math]::Sin($progress * [Math]::PI * 2) + 1) * 2))
    }
    "comfort-loop" {
      $drawWidth = 188
      $drawHeight = 188
      $offsetY = 10 + [int]([Math]::Round([Math]::Abs($cycle) * 3))
      $offsetX = -2
    }
    "celebrate-hop" {
      $offsetY = -[int]([Math]::Round([Math]::Sin($progress * [Math]::PI) * 22))
    }
    "health-watch" {
      $drawWidth = 186
      $drawHeight = 186
      $offsetY = 14 + [int]([Math]::Round(([Math]::Sin($progress * [Math]::PI * 2) + 1) * 2))
      $offsetX = -1
    }
  }

  $targetX = $slotLeft + [int](($script:SpriteSlotSize - $drawWidth) / 2) + $offsetX
  $targetY = $script:SpriteSlotSize - $drawHeight - 10 + $offsetY
  $destRect = [System.Drawing.Rectangle]::new($targetX, $targetY, $drawWidth, $drawHeight)
  $Graphics.DrawImage($BaseBitmap, $destRect)
}

function Save-SpriteStrip {
  param(
    [System.Drawing.Bitmap]$BaseBitmap,
    $Bounds,
    [string]$Action,
    [string]$Path
  )

  $frames = $script:SpriteSpecs[$Action].Frames
  $canvas = New-Canvas -Width ($frames * $script:SpriteSlotSize) -Height $script:SpriteSlotSize

  for ($slot = 0; $slot -lt $frames; $slot++) {
    Draw-SpriteFrame -Graphics $canvas.Graphics -BaseBitmap $BaseBitmap -SlotIndex $slot -Action $Action -Bounds $Bounds
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
    $spriteDir = Join-Path $templatePath "sprites"

    foreach ($accessoryId in @(
      "forest-bandana",
      "navy-collar",
      "copper-collar",
      "heart-tag",
      "trail-bandana",
      "birthday-hat",
      "sleepy-mask",
      "training-vest",
      "cozy-bed",
      "heart-sparkles"
    )) {
      Save-AccessoryAsset -Bounds $bounds -TemplateId $templateId -AccessoryId $accessoryId -Path (Join-Path $accessoryDir "$accessoryId.png")
    }

    foreach ($emoteId in @(
      "happy",
      "calm",
      "excited",
      "bored",
      "hungry",
      "anxious",
      "sleepy",
      "proud",
      "home_alone",
      "not_feeling_well"
    )) {
      Save-EmoteAsset -BaseBitmap $baseBitmap -Bounds $bounds -EmoteId $emoteId -Path (Join-Path $emoteDir "$emoteId.png")
    }

    foreach ($action in @(
      "tail-wag",
      "ear-perk",
      "eat-loop",
      "sleep-loop",
      "comfort-loop",
      "celebrate-hop",
      "health-watch"
    )) {
      Save-SpriteStrip -BaseBitmap $baseBitmap -Bounds $bounds -Action $action -Path (Join-Path $spriteDir "$action-strip.png")
    }
  }
  finally {
    $baseBitmap.Dispose()
  }
}
