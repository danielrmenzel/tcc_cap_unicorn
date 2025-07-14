# Claude Instructions

This file contains instructions and context for Claude to help with the assembly web app project.

## Project Overview
This is a TinyCC WebAssembly compilation system with dynamic function call correction capabilities. The main components are:

- **TinyCC WebAssembly compilation** - Compiles C code to machine code
- **Unicorn Engine x86-64 emulation** - Executes the compiled code
- **Dynamic call target correction** - Fixes TinyCC's incorrect function call targets
- **Function boundary detection** - Identifies function starts/ends in assembly
- **Call recursion analysis** - Distinguishes legitimate vs false recursion

## Key Files
- `raw-code-loader.js` - Main logic for call fixing and function detection
- `index.html` - Main application interface
- `tcc-wrapper/compile_c_to_hex.c` - TinyCC compilation wrapper

## Current Issues Fixed
- ✅ Infinite loop when `func()` calls itself instead of `func2()`
- ✅ Memory write consistency in call target correction
- ✅ Over-aggressive call fixing breaking valid function calls with loops
- ✅ Function highlighting bug with loops and conditionals
- ✅ Multi-color function highlighting for visual distinction

## Latest Enhancements (2025)

### **C Function Highlighting System v2.0**
- **Advanced Brace Matching**: Functions with loops, conditionals, and nested structures now highlight completely
- **Multi-Color System**: 5-color palette with position-based assignment
- **Color Assignments**:
  - Blue: `main()` function (always)
  - Green: First non-main function
  - Orange: Second non-main function  
  - Purple: Third non-main function
  - Red: Fourth non-main function (cycles after this)
- **Performance**: Intelligent caching and efficient cleanup
- **Backward Compatibility**: All existing functionality preserved

### **Key Files Modified**
- `app/index.html` (line ~2770): Enhanced `findFunctionEndLine()` with proper brace nesting
- `app/index.html` (line ~2820): Multi-color highlighting logic
- `app/demo.css`: Added 5 new color classes for function highlighting
- `app/index.html` (line ~2950): Updated cleanup functions for all color classes

## Testing Commands
- `python3 serve.py` - Start development server
- `python3 -m http.server 8080` - Alternative server

## Debug Features
- Extensive console logging with 🔧 🎯 🔍 🎨 emojis for different phases
- Function boundary detection debugging
- Call target analysis tracing
- Memory write verification
- Color assignment debugging
- Brace matching level tracking

## Instructions for Claude

### When working on this project:
1. Always preserve existing functionality
2. Use extensive debugging/logging for complex changes
3. Test both simple and complex function call scenarios
4. Be careful with memory writes - ensure consistency
5. Don't break the highlighting system
6. Test with functions containing loops and conditionals
7. Verify multi-color highlighting works with different function counts

### Common tasks:
- Analyzing TinyCC call target issues
- Improving function boundary detection
- Debugging infinite loops in compiled code
- Testing multi-function C programs
- Enhancing visual debugging features
- Fixing highlighting system bugs

### Code patterns to watch for:
- Functions calling other functions (inter-function calls)
- Functions with loops calling other functions
- False recursion detection
- Memory mapping and writing consistency
- Brace matching in nested structures
- Function color assignment consistency

---

*Add your specific instructions below this line*

## Current Instructions
make sure that all kinds of function calls work even when theres also loops involved.
here's some examples that must work!
when chaning code, always keep in mind that previous functionalities have to work still.

example1:
int func2(int b);
int func(int a){
    for(int i = 0; i < 5; i++){
    	a += i;
    }
    
    return func2(a);
}
int func2(int b){
    return b * 2;
}

int main() {
    return func(2);
}

example2:
/* forward declarations */
int fA(int n, int sum);
int fB(int n, int sum);
int fC(int n, int sum);

/* ---- function definitions ---- */

int fA(int n, int sum)          /* ID = 1 */
{
    sum += 1;
    if (n == 0) return sum;     /* base-case return */
    return fB(n - 1, sum);      /* call the next link */
}

int fB(int n, int sum)          /* ID = 2 */
{
    sum += 2;
    if (n == 0) return sum;
    return fC(n - 1, sum);
}

int fC(int n, int sum)          /* ID = 3 */
{
    sum += 3;
    if (n == 0) return sum;
    return fA(n - 1, sum);      /* wrap back to fA */
}

/* ---- entry point ---- */

int main(void)
{
    int loops = 4;              /* how many full cycles to run */
    int result = fA(loops * 3 - 1, 0);
    /* loops*3-1 ensures exactly `loops` visits to each function */
    return 0;
}

it is of utmost importance to retain the functionalities that work already.
when making changes, always keep in mind that other code snippets have to work as well and it has to be dynamic, not hard coded.
