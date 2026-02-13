<?php
/**
 * Plugin Name: Bricks BEM Generator
 * Description: Genera clases BEM automáticamente desde el panel de estructura de Bricks.
 * Version: 1.0
 * Author: Samir Haddad
 * Author URI: https://samirh.com/
 */

if ( ! defined( 'ABSPATH' ) ) exit;

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