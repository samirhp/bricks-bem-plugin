<?php
/**
 * Plugin Name: Bricks BEM Generator
 * Description: Automatically generate BEM classes from the Bricks structure panel.
 * Version: 1.3.1
 * Author: Samir Haddad
 * Author URI: https://samirh.com/
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 */

if ( ! defined( 'ABSPATH' ) ) exit;

// 1. Cargar la librería de actualizaciones
require 'plugin-update-checker/plugin-update-checker.php';

use YahnisElsts\PluginUpdateChecker\v5\PucFactory;

// 2. Configurar el actualizador con GitHub
$myUpdateChecker = PucFactory::buildUpdateChecker(
	'https://github.com/samirhp/bricks-bem-plugin',
	__FILE__,
	'bricks-bem-generator'
);
$myUpdateChecker->setBranch('main');

// 3. Cargar los scripts y estilos (Prioridad baja para cargar al final)
add_action( 'wp_enqueue_scripts', 'bbem_enqueue_assets', 9999 );

function bbem_enqueue_assets() {
    // Solo cargamos los recursos si estamos dentro del editor de Bricks
    if ( function_exists( 'bricks_is_builder_main' ) && bricks_is_builder_main() ) {
        
        $plugin_url  = plugin_dir_url( __FILE__ );
        $plugin_path = plugin_dir_path( __FILE__ );
        
        // LÓGICA INTELIGENTE: Usar la versión minificada si existe, si no, usar la normal
        $css_file = file_exists( $plugin_path . 'style.min.css' ) ? 'style.min.css' : 'style.css';
        $js_file  = file_exists( $plugin_path . 'script.min.js' ) ? 'script.min.js' : 'script.js';

        // Usar filemtime para la caché exacta del archivo que estamos cargando
        $css_ver = filemtime( $plugin_path . $css_file );
        $js_ver  = filemtime( $plugin_path . $js_file );

        // Encolar los archivos
        wp_enqueue_style( 'bbem-styles', $plugin_url . $css_file, [], $css_ver );
        wp_enqueue_script( 'bbem-script', $plugin_url . $js_file, [], $js_ver, true );
    }
}