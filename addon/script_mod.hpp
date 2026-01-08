#define MAINPREFIX x
#define PREFIX llmgm

#include "script_version.hpp"

#define VERSION MAJOR.MINOR.PATCHLVL.BUILD
#define VERSION_AR MAJOR,MINOR,PATCHLVL,BUILD

// MINIMAL required version for the Mod. Components can specify others..
#define REQUIRED_VERSION 2.00
#define REQUIRED_CBA_VERSION {3,15,6}

#ifdef COMPONENT_BEAUTIFIED
    #define COMPONENT_NAME QUOTE(LLM Game Master - COMPONENT_BEAUTIFIED)
#else
    #define COMPONENT_NAME QUOTE(LLM Game Master - COMPONENT)
#endif
