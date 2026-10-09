// Kept outside the "use client" preferences module so the server layout can inline it.
export const THEME_KEY = "r53-theme";
export const DENSITY_KEY = "r53-density";

/**
 * Runs before React hydrates so a stored dark-mode or compact preference is
 * applied without flashing the default theme first.
 */
export const THEME_BOOT_SCRIPT = `try{var b=document.body;if(localStorage.getItem("${THEME_KEY}")==="dark"){b.classList.add("awsui-polaris-dark-mode","awsui-dark-mode")}if(localStorage.getItem("${DENSITY_KEY}")==="compact"){b.classList.add("awsui-polaris-compact-mode","awsui-compact-mode")}}catch(e){}`;
