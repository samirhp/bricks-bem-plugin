<?php
/**
 * Plugin Name: Bricks BEM Generator
 * Description: Automatically generate BEM classes from the Bricks structure panel.
 * Version: 1.1
 * Author: Samir Haddad
 * Author URI: https://samirh.com/
 */

if ( ! defined( 'ABSPATH' ) ) exit;

// 1. Cargar la librería
require 'plugin-update-checker/plugin-update-checker.php';

// 2. Configurar el actualizador
use YahnisElsts\PluginUpdateChecker\v5\PucFactory;

$myUpdateChecker = PucFactory::buildUpdateChecker(
	'https://github.com/samirhp/bricks-bem-plugin', // URL de tu repo en GitHub
	__FILE__, // Archivo principal del plugin
	'bricks-bem-generator' // Slug del plugin (debe coincidir con la carpeta)
);

// 3. Opcional: Configurar la rama (por defecto es 'master' o 'main')
$myUpdateChecker->setBranch('main');

// Usamos el gancho estándar pero con prioridad muy alta (9999) para asegurarnos que cargue al final
add_action( 'wp_enqueue_scripts', 'bbem_enqueue_assets', 9999 );

function bbem_enqueue_assets() {
    // ESTA ES LA CLAVE: Solo cargamos si estamos dentro del editor de Bricks
    if ( function_exists( 'bricks_is_builder_main' ) && bricks_is_builder_main() ) {
        
        $plugin_url = plugin_dir_url( __FILE__ );
        
        // Usamos time() para obligar al navegador a cargar la versión nueva siempre
        $version = time(); 

        // Cargar CSS
        wp_enqueue_style( 'bbem-styles', $plugin_url . 'style.css', [], $version );

        // Cargar JS (en el footer)
        wp_enqueue_script( 'bbem-script', $plugin_url . 'script.js', [], $version, true );
    }
}