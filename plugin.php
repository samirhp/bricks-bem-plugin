<?php
/**
 * Plugin Name: Bricks BEM Generator
 * Description: Automatically generate BEM classes from the Bricks structure panel.
 * Version: 1.2
 * Author: Samir Haddad
 * Author URI: https://samirh.com/
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 */

if ( ! defined( 'ABSPATH' ) ) exit;

// 1. Cargar la librería
require 'plugin-update-checker/plugin-update-checker.php';

// 2. Configurar el actualizador
use YahnisElsts\PluginUpdateChecker\v5\PucFactory;

$myUpdateChecker = PucFactory::buildUpdateChecker(
	'https://github.com/samirhp/bricks-bem-plugin',
	__FILE__,
	'bricks-bem-generator'
);
$myUpdateChecker->setBranch('main');

add_action( 'wp_enqueue_scripts', 'bbem_enqueue_assets', 9999 );

function bbem_enqueue_assets() {
    // Solo cargamos si estamos dentro del editor de Bricks
    if ( function_exists( 'bricks_is_builder_main' ) && bricks_is_builder_main() ) {
        
        $plugin_url = plugin_dir_url( __FILE__ );
        $plugin_path = plugin_dir_path( __FILE__ );
        
        // MEJORA RENDIMIENTO: Usamos la fecha de modificación del archivo. 
        // Así el navegador guarda caché y solo descarga si tú actualizas el código.
        $css_ver = filemtime( $plugin_path . 'style.css' );
        $js_ver  = filemtime( $plugin_path . 'script.js' );

        wp_enqueue_style( 'bbem-styles', $plugin_url . 'style.css', [], $css_ver );
        wp_enqueue_script( 'bbem-script', $plugin_url . 'script.js', [], $js_ver, true );
    }
}