package com.enchantcalc.itemdumper;

import com.google.common.collect.Multimap;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

import net.minecraft.command.CommandBase;
import net.minecraft.command.ICommandSender;
import net.minecraft.creativetab.CreativeTabs;
import net.minecraft.entity.SharedMonsterAttributes;
import net.minecraft.entity.ai.attributes.AttributeModifier;
import net.minecraft.inventory.EntityEquipmentSlot;
import net.minecraft.item.Item;
import net.minecraft.item.ItemArmor;
import net.minecraft.item.ItemFood;
import net.minecraft.item.ItemStack;
import net.minecraft.server.MinecraftServer;
import net.minecraft.util.NonNullList;
import net.minecraft.util.ResourceLocation;
import net.minecraft.util.text.TextComponentString;
import net.minecraftforge.fml.common.registry.ForgeRegistries;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * {@code /dumpitems [filter]} - walk the whole item registry, enumerate every
 * creative sub-item, and write each one's in-game stats to JSON.
 *
 * <p>Output goes to {@code <gamedir>/itemdumps/itemdump[-filter].json}. The
 * optional filter narrows the dump:
 * <ul>
 *   <li>{@code all} (default) - every item</li>
 *   <li>{@code weapons} - items with an attack-damage modifier</li>
 *   <li>{@code armor} - {@link ItemArmor} instances</li>
 *   <li>{@code combat} - weapons + armor</li>
 * </ul>
 */
public class DumpCommand extends CommandBase {

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().disableHtmlEscaping().create();

    private static final String ATTACK_DAMAGE = SharedMonsterAttributes.ATTACK_DAMAGE.getName();
    private static final String ATTACK_SPEED = SharedMonsterAttributes.ATTACK_SPEED.getName();
    private static final String ARMOR = SharedMonsterAttributes.ARMOR.getName();
    private static final String ARMOR_TOUGHNESS = SharedMonsterAttributes.ARMOR_TOUGHNESS.getName();

    @Override
    public String getName() {
        return "dumpitems";
    }

    @Override
    public String getUsage(ICommandSender sender) {
        return "/dumpitems [all|weapons|armor|combat]";
    }

    @Override
    public int getRequiredPermissionLevel() {
        return 2;
    }

    @Override
    public void execute(MinecraftServer server, ICommandSender sender, String[] args) {
        String filter = args.length > 0 ? args[0].toLowerCase(Locale.ROOT) : "all";

        List<Map<String, Object>> rows = new ArrayList<Map<String, Object>>();
        List<Map<String, Object>> errors = new ArrayList<Map<String, Object>>();

        for (Item item : ForgeRegistries.ITEMS) {
            ResourceLocation rl = item.getRegistryName();
            if (rl == null) {
                continue;
            }
            try {
                for (ItemStack stack : enumerateStacks(item)) {
                    Map<String, Object> row = describe(item, rl, stack);
                    if (matchesFilter(row, filter)) {
                        rows.add(row);
                    }
                }
            } catch (Throwable t) {
                Map<String, Object> err = new LinkedHashMap<String, Object>();
                err.put("registryName", rl.toString());
                err.put("itemClass", item.getClass().getName());
                err.put("error", String.valueOf(t));
                errors.add(err);
            }
        }

        Map<String, Object> root = new LinkedHashMap<String, Object>();
        Map<String, Object> meta = new LinkedHashMap<String, Object>();
        meta.put("generator", "itemdumper " + ItemDumper.VERSION);
        meta.put("filter", filter);
        meta.put("itemCount", rows.size());
        meta.put("errorCount", errors.size());
        root.put("meta", meta);
        root.put("items", rows);
        if (!errors.isEmpty()) {
            root.put("errors", errors);
        }

        File dir = new File(server.getDataDirectory(), "itemdumps");
        dir.mkdirs();
        String fileName = "all".equals(filter) ? "itemdump.json" : "itemdump-" + filter + ".json";
        File out = new File(dir, fileName);

        try {
            Writer writer = new OutputStreamWriter(new FileOutputStream(out), StandardCharsets.UTF_8);
            try {
                GSON.toJson(root, writer);
            } finally {
                writer.close();
            }
        } catch (Exception e) {
            sender.sendMessage(new TextComponentString("[ItemDumper] Failed to write dump: " + e));
            return;
        }

        sender.sendMessage(new TextComponentString(
                "[ItemDumper] Wrote " + rows.size() + " items (" + errors.size() + " errors) to "
                        + out.getAbsolutePath()));
    }

    /** Enumerate every creative variant of an item; fall back to the bare stack. */
    private List<ItemStack> enumerateStacks(Item item) {
        NonNullList<ItemStack> subItems = NonNullList.create();
        try {
            item.getSubItems(CreativeTabs.SEARCH, subItems);
        } catch (Throwable ignored) {
            // Some modded items misbehave during enumeration; fall back below.
        }
        List<ItemStack> result = new ArrayList<ItemStack>();
        if (subItems.isEmpty()) {
            result.add(new ItemStack(item));
        } else {
            result.addAll(subItems);
        }
        return result;
    }

    private boolean matchesFilter(Map<String, Object> row, String filter) {
        if ("all".equals(filter)) {
            return true;
        }
        boolean isWeapon = row.containsKey("attackDamage");
        boolean isArmor = row.containsKey("armorPoints");
        if ("weapons".equals(filter)) {
            return isWeapon;
        }
        if ("armor".equals(filter)) {
            return isArmor;
        }
        if ("combat".equals(filter)) {
            return isWeapon || isArmor;
        }
        return true;
    }

    private Map<String, Object> describe(Item item, ResourceLocation rl, ItemStack stack) {
        Map<String, Object> row = new LinkedHashMap<String, Object>();
        row.put("registryName", rl.toString());
        row.put("modId", rl.getNamespace());
        row.put("path", rl.getPath());
        row.put("metadata", stack.getMetadata());

        safePut(row, "displayName", new Supplier() {
            public Object get() {
                return stack.getDisplayName();
            }
        });
        safePut(row, "translationKey", new Supplier() {
            public Object get() {
                return stack.getTranslationKey();
            }
        });

        row.put("itemClass", item.getClass().getName());
        row.put("maxStackSize", stack.getMaxStackSize());

        int maxDamage = stack.getMaxDamage();
        if (maxDamage > 0) {
            row.put("durability", maxDamage);
        }

        try {
            int ench = item.getItemEnchantability(stack);
            if (ench > 0) {
                row.put("enchantability", ench);
            }
        } catch (Throwable ignored) {
        }

        CreativeTabs tab = item.getCreativeTab();
        if (tab != null) {
            row.put("creativeTab", tab.getTabLabel());
        }

        // Weapon stats: read the mainhand attribute modifiers (this is how
        // Spartan Weaponry and friends actually set damage/speed). Displayed
        // values fold in the player's base (1.0 damage, 4.0 speed).
        Multimap<String, AttributeModifier> mainhand =
                item.getAttributeModifiers(EntityEquipmentSlot.MAINHAND, stack);
        Double atkMod = sumModifiers(mainhand, ATTACK_DAMAGE);
        Double spdMod = sumModifiers(mainhand, ATTACK_SPEED);
        if (atkMod != null) {
            row.put("attackDamageModifier", round(atkMod));
            row.put("attackDamage", round(1.0 + atkMod));
            row.put("attackSpeed", round(4.0 + (spdMod != null ? spdMod : 0.0)));
        }

        // Armor stats: read the modifiers for the slot the armor occupies.
        if (item instanceof ItemArmor) {
            ItemArmor armor = (ItemArmor) item;
            EntityEquipmentSlot slot = armor.armorType;
            row.put("armorSlot", slot.getName());
            Multimap<String, AttributeModifier> armorMods =
                    item.getAttributeModifiers(slot, stack);
            Double points = sumModifiers(armorMods, ARMOR);
            Double tough = sumModifiers(armorMods, ARMOR_TOUGHNESS);
            row.put("armorPoints", round(points != null ? points : armor.damageReduceAmount));
            row.put("toughness", round(tough != null ? tough : armor.toughness));
        }

        // Food stats.
        if (item instanceof ItemFood) {
            ItemFood food = (ItemFood) item;
            try {
                row.put("foodHealAmount", food.getHealAmount(stack));
                row.put("foodSaturation", round(food.getSaturationModifier(stack)));
            } catch (Throwable ignored) {
            }
        }

        return row;
    }

    private Double sumModifiers(Multimap<String, AttributeModifier> map, String key) {
        if (map == null) {
            return null;
        }
        java.util.Collection<AttributeModifier> mods = map.get(key);
        if (mods == null || mods.isEmpty()) {
            return null;
        }
        double sum = 0.0;
        for (AttributeModifier m : mods) {
            sum += m.getAmount();
        }
        return sum;
    }

    private static void safePut(Map<String, Object> row, String key, Supplier supplier) {
        try {
            Object v = supplier.get();
            if (v != null) {
                row.put(key, v);
            }
        } catch (Throwable ignored) {
        }
    }

    private static double round(double v) {
        return Math.round(v * 1000.0) / 1000.0;
    }

    private interface Supplier {
        Object get();
    }
}
