#define COMPONENT main
#define COMPONENT_BEAUTIFIED Main
#include "\x\llmgm\addons\main\script_mod.hpp"

// Uncomment for debugging
// #define DEBUG_MODE_FULL
// #define DISABLE_COMPILE_CACHE

#ifdef DEBUG_ENABLED_MAIN
    #define DEBUG_MODE_FULL
#endif

#ifdef DEBUG_SETTINGS_MAIN
    #define DEBUG_SETTINGS DEBUG_SETTINGS_MAIN
#endif

// Component macros
#define ADDON DOUBLES(PREFIX,COMPONENT)
#define GVAR(VAR) TRIPLES(PREFIX,COMPONENT,VAR)
#define QGVAR(VAR) QUOTE(GVAR(VAR))
#define QQGVAR(VAR) QUOTE(QGVAR(VAR))
#define FUNC(FUNCTION) TRIPLES(PREFIX,fnc,FUNCTION)
#define QFUNC(FUNCTION) QUOTE(FUNC(FUNCTION))
#define QQFUNC(FUNCTION) QUOTE(QFUNC(FUNCTION))

// Function preparation macros (for XEH_PREP.hpp)
#define PREP(fncName) FUNC(fncName) = {_this call FUNC(fncName)}
#define PREP_RECOMPILE_START    if (uiNamespace getVariable [QUOTE(DOUBLES(PREFIX,recompile)),false]) then {
#define PREP_RECOMPILE_END      }

// Utility macros
#define DOUBLES(var1,var2) ##var1##_##var2
#define TRIPLES(var1,var2,var3) ##var1##_##var2##_##var3
#define QUOTE(var) #var
