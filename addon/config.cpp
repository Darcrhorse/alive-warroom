class Extended_PreInit_EventHandlers {
    class llmgm_main {
        init = "call compile preprocessFileLineNumbers 'llmgm\XEH_preInit.sqf'";
    };
};

class Extended_PostInit_EventHandlers {
    class llmgm_main {
        init = "call compile preprocessFileLineNumbers 'llmgm\XEH_postInit.sqf'";
    };
};

class CfgPatches {
    class llmgm_main {
        name = "LLM Game Master";
        author = "LLM GM Team";
        url = "";
        units[] = {};
        weapons[] = {};
        requiredVersion = 2.00;
        requiredAddons[] = {"A3_Functions_F", "cba_main", "cba_xeh"};
        version = "0.1.0";
        versionStr = "0.1.0";
        versionAr[] = {0,1,0};
    };
};

class CfgFunctions {
    class LLMGM {
        tag = "LLMGM";
        
        class Core {
            file = "\x\llmgm\addons\main\functions";
            
            class initGameMaster {
                postInit = 0;
                ext = ".sqf";
            };
            
            class collectGameState {
                ext = ".sqf";
            };
            
            class sendToBridge {
                ext = ".sqf";
            };
            
            class receiveFromBridge {
                ext = ".sqf";
            };
            
            class executeGenerated {
                ext = ".sqf";
            };
            
            class logEvent {
                ext = ".sqf";
            };
            
            class registerCallbacks {
                ext = ".sqf";
            };
        };
    };
};
