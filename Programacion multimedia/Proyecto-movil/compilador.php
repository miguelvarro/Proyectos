<?php

$destination = "C:/xampp/htdocs/proyecto-movil-build/";


if (!is_dir($destination)) {
  mkdir($destination, 0777, true);
}

// ---- Compile index.php into index.html ----
ob_start();
include "index.php";
$html = ob_get_clean();

file_put_contents($destination . "index.html", $html);

// ---- Recursive copy function ----
function copyRecursive($source, $dest) {
  if (is_dir($source)) {
    if (!is_dir($dest)) {
      mkdir($dest, 0777, true);
    }
    $items = scandir($source);
    foreach ($items as $item) {
      if ($item == "." || $item == "..") continue;
      $srcPath = $source . "/" . $item;
      $destPath = $dest . "/" . $item;
      if (is_dir($srcPath)) copyRecursive($srcPath, $destPath);
      else copy($srcPath, $destPath);
    }
  } else {
    copy($source, $dest);
  }
}

// ----  Copy folders ----
$folders = ["static", "img", "audio", "api"];

foreach ($folders as $folder) {
  if (is_dir($folder)) {
    copyRecursive($folder, $destination . $folder);
  }
}

echo "✅ Compilation complete\n";

