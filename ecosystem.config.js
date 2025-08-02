/**
 * This module exports an object that configures the applications managed by PM2.
 * The object has a single property, apps, which is an array of objects.
 * Each object in the array represents an application and has the following properties:
 * - name: The name of the application.
 * - script: The path to the script to run.
 * - watch: A boolean indicating whether to watch the script for changes and restart the application if changes are detected.
 * - ignore_watch: An array of paths to ignore when watching for changes.
 * - autorestart: A boolean indicating whether to automatically restart the application if it crashes or stops.
 * - instances: The number of instances of the application to run.
 * - exec_mode: The execution mode of the application. If set to "cluster", the application will be run in cluster mode.
 * - max_memory_restart: The maximum amount of memory the application can use before it is restarted.
 * - cron_restart: A cron pattern specifying when to restart the application. This property is only present in the second application.
 */
module.exports = {
    apps : [{
        name   : "server",
        script : "./server.js",
        watch  : true,
        ignore_watch : ["node_modules", "\\.git", "logs/*.log"],
        autorestart: true,
        instances : 1,
        exec_mode : "cluster",
        max_memory_restart : "500M"
    },{
        name   : "cron",
        script : "./cron.js",
        watch  : false,
        autorestart: false,
        cron_restart: '*/30 8-20 * * *',
        ignore_watch : ["node_modules", "\\.git", "logs/*.log"],
        max_memory_restart : "2G"
    }
]
}