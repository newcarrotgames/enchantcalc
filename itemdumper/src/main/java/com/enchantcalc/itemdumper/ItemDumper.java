package com.enchantcalc.itemdumper;

import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.common.event.FMLServerStartingEvent;

/**
 * Entry point. Registers the {@code /dumpitems} server command when a world
 * (integrated or dedicated server) starts.
 */
@Mod(
        modid = ItemDumper.MODID,
        name = ItemDumper.NAME,
        version = ItemDumper.VERSION,
        acceptableRemoteVersions = "*"
)
public class ItemDumper {
    public static final String MODID = "itemdumper";
    public static final String NAME = "Item Dumper";
    public static final String VERSION = "1.0.0";

    @Mod.EventHandler
    public void serverStarting(FMLServerStartingEvent event) {
        event.registerServerCommand(new DumpCommand());
    }
}
