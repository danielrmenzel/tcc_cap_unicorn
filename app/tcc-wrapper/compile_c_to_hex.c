//compile_c_to_hex.c
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include "libtcc.h"
#include <emscripten.h>
#include <stdint.h>

#define EI_NIDENT 16
#define STT_FUNC 2
#define ELF64_ST_TYPE(val) ((val) & 0xf)

typedef struct {
    unsigned char e_ident[EI_NIDENT];
    uint16_t      e_type;
    uint16_t      e_machine;
    uint32_t      e_version;
    uint64_t      e_entry;
    uint64_t      e_phoff;
    uint64_t      e_shoff;
    uint32_t      e_flags;
    uint16_t      e_ehsize;
    uint16_t      e_phentsize;
    uint16_t      e_phnum;
    uint16_t      e_shentsize;
    uint16_t      e_shnum;
    uint16_t      e_shstrndx;
} Elf64_Ehdr;

typedef struct {
    uint32_t sh_name;
    uint32_t sh_type;
    uint64_t sh_flags;
    uint64_t sh_addr;
    uint64_t sh_offset;
    uint64_t sh_size;
    uint32_t sh_link;
    uint32_t sh_info;
    uint64_t sh_addralign;
    uint64_t sh_entsize;
} Elf64_Shdr;

typedef struct {
    uint32_t st_name;
    unsigned char st_info;
    unsigned char st_other;
    uint16_t st_shndx;
    uint64_t st_value;
    uint64_t st_size;
} Elf64_Sym;

EMSCRIPTEN_KEEPALIVE
uint8_t* compile_and_get_text(const char* source_path, int* out_size) {
    // 1) Create TCC, compile input.c → out.o
    fprintf(stderr, "[TCC] Creating compiler state...\n");
    TCCState *s = tcc_new();
    if (!s) { fprintf(stderr, "[TCC] tcc_new failed\n"); return NULL; }
    tcc_set_output_type(s, TCC_OUTPUT_OBJ);
    tcc_add_include_path(s, "/");
    tcc_add_include_path(s, "/tinycc-headers");
    fprintf(stderr, "[TCC] Adding source file: %s\n", source_path);
    if (tcc_add_file(s, source_path) < 0) {
        fprintf(stderr, "[TCC] Failed to compile %s\n", source_path);
        tcc_delete(s);
        return NULL;
    }
    fprintf(stderr, "[TCC] Writing output object file...\n");
    if (tcc_output_file(s, "out.o") < 0) {
        fprintf(stderr, "[TCC] Failed to write out.o\n");
        tcc_delete(s);
        return NULL;
    }
    tcc_delete(s);

    // 2) Read the ELF
    FILE *f = fopen("out.o","rb");
    if (!f) { fprintf(stderr, "[TCC] fopen(out.o) failed\n"); return NULL; }
    fseek(f,0,SEEK_END);
    long file_size = ftell(f);
    rewind(f);
    uint8_t *elf = malloc(file_size);
    fread(elf,1,file_size,f);
    fclose(f);

    fprintf(stderr, "[TCC] Dumping full ELF (%ld bytes):\n", file_size);
    for (int i = 0; i < file_size; i += 16) {
        fprintf(stderr, "%04x: ", i);
        for (int j = 0; j < 16 && i+j < file_size; j++)
            fprintf(stderr, "%02x ", elf[i+j]);
        fprintf(stderr, "\n");
    }

    // 3) Locate the section headers
    Elf64_Ehdr *eh = (Elf64_Ehdr*)elf;
    fprintf(stderr, "[TCC] Section header table at 0x%llx, %d entries, strtab index %d\n",
            (unsigned long long)eh->e_shoff, eh->e_shnum, eh->e_shstrndx);

    Elf64_Shdr *sh = (Elf64_Shdr*)(elf + eh->e_shoff);
    // string table for section names:
    const char *strtab = (const char*)(elf + sh[eh->e_shstrndx].sh_offset);

    // 4) Print them all, look for ".text"
    for (int i = 0; i < eh->e_shnum; i++) {
        const char *name = strtab + sh[i].sh_name;
        fprintf(stderr, "[TCC] Section %2d: name='%s' (off=%llu size=%llu)\n",
                i, name,
                (unsigned long long)sh[i].sh_offset,
                (unsigned long long)sh[i].sh_size);
    }

    // 5) Extract any section whose name starts ".text"
    for (int i = 0; i < eh->e_shnum; i++) {
        const char *name = strtab + sh[i].sh_name;
        if (strncmp(name, ".text", 5) == 0) {
            fprintf(stderr, "[TCC] ✅ Extracting section '%s'\n", name);
            int sz = sh[i].sh_size;
            uint8_t *out = malloc(sz);
            memcpy(out, elf + sh[i].sh_offset, sz);
            *out_size = sz;
            free(elf);
            return out;
        }
    }

    fprintf(stderr, "[TCC] No .text* section found\n");
    free(elf);
    return NULL;
}

EMSCRIPTEN_KEEPALIVE
void extract_symbols(const char* elf_path) {
    FILE *f = fopen(elf_path, "rb");
    if (!f) {
        fprintf(stderr, "[TCC] Failed to open ELF file: %s\n", elf_path);
        return;
    }

    // Read the ELF file into memory
    fseek(f, 0, SEEK_END);
    long file_size = ftell(f);
    rewind(f);
    uint8_t *elf = malloc(file_size);
    fread(elf, 1, file_size, f);
    fclose(f);

    // Parse ELF header
    Elf64_Ehdr *eh = (Elf64_Ehdr*)elf;
    Elf64_Shdr *sh = (Elf64_Shdr*)(elf + eh->e_shoff);
    const char *shstrtab = (const char*)(elf + sh[eh->e_shstrndx].sh_offset);

    // Locate .symtab and .strtab
    Elf64_Shdr *symtab = NULL, *strtab = NULL;
    for (int i = 0; i < eh->e_shnum; i++) {
        const char *section_name = shstrtab + sh[i].sh_name;
        if (strcmp(section_name, ".symtab") == 0) {
            symtab = &sh[i];
        } else if (strcmp(section_name, ".strtab") == 0) {
            strtab = &sh[i];
        }
    }

    if (!symtab || !strtab) {
        fprintf(stderr, "[TCC] .symtab or .strtab not found in ELF file\n");
        free(elf);
        return;
    }

    // Parse symbols
    const char *strtab_data = (const char*)(elf + strtab->sh_offset);
    Elf64_Sym *symbols = (Elf64_Sym*)(elf + symtab->sh_offset);
    int num_symbols = symtab->sh_size / sizeof(Elf64_Sym);

    fprintf(stderr, "[TCC] Found %d symbols in .symtab\n", num_symbols);
    for (int i = 0; i < num_symbols; i++) {
        const char *name = strtab_data + symbols[i].st_name;
        if (ELF64_ST_TYPE(symbols[i].st_info) == STT_FUNC) { // Check if it's a function
            fprintf(stderr, "Function: %s at 0x%llx\n", name, (unsigned long long)symbols[i].st_value);
        }
    }

    free(elf);
}

// Global storage for rodata section
static uint8_t* g_rodata_data = NULL;
static int g_rodata_size = 0;
static uint64_t g_rodata_base = 0x3000;

EMSCRIPTEN_KEEPALIVE
uint8_t* get_rodata_data(int* out_size) {
    if (!g_rodata_data) {
        *out_size = 0;
        return NULL;
    }
    *out_size = g_rodata_size;
    return g_rodata_data;
}

EMSCRIPTEN_KEEPALIVE
uint64_t get_rodata_base() {
    return g_rodata_base;
}

EMSCRIPTEN_KEEPALIVE
void extract_rodata(const char* obj_path) {
    // Clean up previous rodata
    if (g_rodata_data) {
        free(g_rodata_data);
        g_rodata_data = NULL;
        g_rodata_size = 0;
    }
    
    FILE *f = fopen(obj_path, "rb");
    if (!f) {
        fprintf(stderr, "[RODATA] Failed to open %s\n", obj_path);
        return;
    }
    
    fseek(f, 0, SEEK_END);
    long file_size = ftell(f);
    rewind(f);
    uint8_t *elf = malloc(file_size);
    fread(elf, 1, file_size, f);
    fclose(f);
    
    Elf64_Ehdr *eh = (Elf64_Ehdr*)elf;
    Elf64_Shdr *sh = (Elf64_Shdr*)(elf + eh->e_shoff);
    const char *strtab = (const char*)(elf + sh[eh->e_shstrndx].sh_offset);
    
    // Look for .rodata section
    for (int i = 0; i < eh->e_shnum; i++) {
        const char *name = strtab + sh[i].sh_name;
        if (strncmp(name, ".rodata", 7) == 0 || strncmp(name, ".data.ro", 8) == 0) {
            fprintf(stderr, "[RODATA] ✅ Found section '%s'\n", name);
            
            g_rodata_size = sh[i].sh_size;
            g_rodata_data = malloc(g_rodata_size);
            memcpy(g_rodata_data, elf + sh[i].sh_offset, g_rodata_size);
            
            fprintf(stderr, "[RODATA] Extracted %d bytes\n", g_rodata_size);
            break;
        }
    }
    
    free(elf);
}
