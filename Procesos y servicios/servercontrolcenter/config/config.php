<?php
declare(strict_types=1);

/**
 * Config global del proyecto
 * Ajusta rutas y credenciales aquí y el resto se adapta.
 */

return [
  // Basic Auth (mismo usuario/pass que uses en admin.php y monitor.php)
  'users' => [
    'miguel' => '1234',
  ],

  // Rutas base
  'root_dir'    => realpath(__DIR__ . '/..'),
  'data_dir'    => realpath(__DIR__ . '/..') . DIRECTORY_SEPARATOR . 'monitor_data',
  'scripts_dir' => realpath(__DIR__ . '/..') . DIRECTORY_SEPARATOR . 'scripts',
  'log_dir'     => realpath(__DIR__ . '/..') . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'logs',

  // Scripts
  'monitor_script' => realpath(__DIR__ . '/..') . DIRECTORY_SEPARATOR . 'scripts' . DIRECTORY_SEPARATOR . 'server_monitor.py',
  'runner_script'  => realpath(__DIR__ . '/..') . DIRECTORY_SEPARATOR . 'scripts' . DIRECTORY_SEPARATOR . 'monitor_runner.py',

  // Runner / PID
  'pid_file' => realpath(__DIR__ . '/..') . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'logs' . DIRECTORY_SEPARATOR . 'monitor.pid',

  // Intervalo recomendado (segundos)
  'interval_seconds' => 2,

  // Endpoints disponibles (nombres de CSV sin extensión)
  'endpoints' => [
    'cpu',
    'ram',
    'disk_usage',
    'disk_io_read',
    'disk_io_write',
    'bandwidth_rx',
    'bandwidth_tx',
    'processes_count',
    'apache_request_rate',
  ],
];

