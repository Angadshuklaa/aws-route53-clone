export const THEME_KEY = "r53-theme";
export const DENSITY_KEY = "r53-density";

export const THEME_BOOT_SCRIPT = `try{var b=document.body;if(localStorage.getItem("${THEME_KEY}")==="dark"){b.classList.add("awsui-polaris-dark-mode","awsui-dark-mode")}if(localStorage.getItem("${DENSITY_KEY}")==="compact"){b.classList.add("awsui-polaris-compact-mode","awsui-compact-mode")}}catch(e){}`;
