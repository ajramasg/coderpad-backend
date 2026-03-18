export interface Question {
  id: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  description: string;
  defaultLanguage: string;
  starterCode: Partial<Record<string, string>>;
}

export const QUESTIONS: Question[] = [
  // ── Easy ──────────────────────────────────────────────────────────────────
  {
    id: 'two-sum',
    title: 'Two Sum',
    difficulty: 'easy',
    tags: ['Array', 'Hash Map'],
    defaultLanguage: 'javascript',
    description: `Given an array of integers \`nums\` and an integer \`target\`, return the indices of the two numbers that add up to \`target\`.

You may assume exactly one solution exists. You may not use the same element twice.

**Example 1**
Input:  nums = [2,7,11,15], target = 9
Output: [0,1]

**Example 2**
Input:  nums = [3,2,4], target = 6
Output: [1,2]

**Constraints**
• 2 ≤ nums.length ≤ 10⁴
• −10⁹ ≤ nums[i] ≤ 10⁹
• Exactly one valid answer exists`,
    starterCode: {
      javascript: `function twoSum(nums, target) {
  // Your solution here
}

console.log(twoSum([2, 7, 11, 15], 9)); // [0, 1]
console.log(twoSum([3, 2, 4], 6));      // [1, 2]
console.log(twoSum([3, 3], 6));         // [0, 1]
`,
      python: `def two_sum(nums: list[int], target: int) -> list[int]:
    # Your solution here
    pass

print(two_sum([2, 7, 11, 15], 9))  # [0, 1]
print(two_sum([3, 2, 4], 6))       # [1, 2]
print(two_sum([3, 3], 6))          # [0, 1]
`,
      typescript: `function twoSum(nums: number[], target: number): number[] {
  // Your solution here
  return [];
}

console.log(twoSum([2, 7, 11, 15], 9)); // [0, 1]
console.log(twoSum([3, 2, 4], 6));      // [1, 2]
`,
    },
  },

  {
    id: 'valid-parentheses',
    title: 'Valid Parentheses',
    difficulty: 'easy',
    tags: ['Stack', 'String'],
    defaultLanguage: 'javascript',
    description: `Given a string \`s\` containing only \`(\`, \`)\`, \`{\`, \`}\`, \`[\`, \`]\`, determine if the input is valid.

A string is valid if:
1. Open brackets are closed by the same type of bracket.
2. Open brackets are closed in the correct order.
3. Every close bracket has a corresponding open bracket.

**Example 1**
Input:  s = "()"
Output: true

**Example 2**
Input:  s = "()[]{}"
Output: true

**Example 3**
Input:  s = "(]"
Output: false

**Constraints**
• 1 ≤ s.length ≤ 10⁴
• s consists only of parentheses characters`,
    starterCode: {
      javascript: `function isValid(s) {
  // Your solution here
}

console.log(isValid("()"));     // true
console.log(isValid("()[]{}")); // true
console.log(isValid("(]"));     // false
console.log(isValid("([)]"));   // false
console.log(isValid("{[]}"));   // true
`,
      python: `def is_valid(s: str) -> bool:
    # Your solution here
    pass

print(is_valid("()"))     # True
print(is_valid("()[]{}")) # True
print(is_valid("(]"))     # False
print(is_valid("([)]"))   # False
print(is_valid("{[]}"))   # True
`,
    },
  },

  {
    id: 'best-time-stock',
    title: 'Best Time to Buy and Sell Stock',
    difficulty: 'easy',
    tags: ['Array', 'Greedy'],
    defaultLanguage: 'javascript',
    description: `You are given an array \`prices\` where \`prices[i]\` is the price of a stock on day \`i\`.

You want to maximize profit by choosing a single day to buy and a different, later day to sell. Return the maximum profit. If no profit is possible, return 0.

**Example 1**
Input:  prices = [7,1,5,3,6,4]
Output: 5   (buy on day 2 at price 1, sell on day 5 at price 6)

**Example 2**
Input:  prices = [7,6,4,3,1]
Output: 0   (prices only decrease; no profitable transaction)

**Constraints**
• 1 ≤ prices.length ≤ 10⁵
• 0 ≤ prices[i] ≤ 10⁴`,
    starterCode: {
      javascript: `function maxProfit(prices) {
  // Your solution here
}

console.log(maxProfit([7, 1, 5, 3, 6, 4])); // 5
console.log(maxProfit([7, 6, 4, 3, 1]));     // 0
console.log(maxProfit([1, 2]));              // 1
`,
      python: `def max_profit(prices: list[int]) -> int:
    # Your solution here
    pass

print(max_profit([7, 1, 5, 3, 6, 4]))  # 5
print(max_profit([7, 6, 4, 3, 1]))      # 0
print(max_profit([1, 2]))               # 1
`,
    },
  },

  {
    id: 'climbing-stairs',
    title: 'Climbing Stairs',
    difficulty: 'easy',
    tags: ['Dynamic Programming', 'Math'],
    defaultLanguage: 'javascript',
    description: `You are climbing a staircase with \`n\` steps. Each time you can climb 1 or 2 steps. In how many distinct ways can you reach the top?

**Example 1**
Input:  n = 2
Output: 2   (1+1 or 2)

**Example 2**
Input:  n = 3
Output: 3   (1+1+1, 1+2, or 2+1)

**Hint:** Think about what the number of ways to reach step \`n\` depends on.

**Constraints**
• 1 ≤ n ≤ 45`,
    starterCode: {
      javascript: `function climbStairs(n) {
  // Your solution here
}

console.log(climbStairs(2));  // 2
console.log(climbStairs(3));  // 3
console.log(climbStairs(5));  // 8
console.log(climbStairs(10)); // 89
`,
      python: `def climb_stairs(n: int) -> int:
    # Your solution here
    pass

print(climb_stairs(2))   # 2
print(climb_stairs(3))   # 3
print(climb_stairs(5))   # 8
print(climb_stairs(10))  # 89
`,
    },
  },

  // ── Medium ─────────────────────────────────────────────────────────────────
  {
    id: 'longest-substring',
    title: 'Longest Substring Without Repeating Characters',
    difficulty: 'medium',
    tags: ['Sliding Window', 'Hash Map', 'String'],
    defaultLanguage: 'javascript',
    description: `Given a string \`s\`, find the length of the longest substring without repeating characters.

**Example 1**
Input:  s = "abcabcbb"
Output: 3   ("abc")

**Example 2**
Input:  s = "bbbbb"
Output: 1   ("b")

**Example 3**
Input:  s = "pwwkew"
Output: 3   ("wke")

**Constraints**
• 0 ≤ s.length ≤ 5 × 10⁴
• s consists of English letters, digits, symbols and spaces`,
    starterCode: {
      javascript: `function lengthOfLongestSubstring(s) {
  // Your solution here
}

console.log(lengthOfLongestSubstring("abcabcbb")); // 3
console.log(lengthOfLongestSubstring("bbbbb"));    // 1
console.log(lengthOfLongestSubstring("pwwkew"));   // 3
console.log(lengthOfLongestSubstring(""));         // 0
`,
      python: `def length_of_longest_substring(s: str) -> int:
    # Your solution here
    pass

print(length_of_longest_substring("abcabcbb"))  # 3
print(length_of_longest_substring("bbbbb"))     # 1
print(length_of_longest_substring("pwwkew"))    # 3
print(length_of_longest_substring(""))          # 0
`,
    },
  },

  {
    id: 'merge-intervals',
    title: 'Merge Intervals',
    difficulty: 'medium',
    tags: ['Array', 'Sorting'],
    defaultLanguage: 'javascript',
    description: `Given an array of intervals \`[[start, end], ...]\`, merge all overlapping intervals and return the result.

**Example 1**
Input:  intervals = [[1,3],[2,6],[8,10],[15,18]]
Output: [[1,6],[8,10],[15,18]]
Explanation: [1,3] and [2,6] overlap → merge to [1,6]

**Example 2**
Input:  intervals = [[1,4],[4,5]]
Output: [[1,5]]
Explanation: touching intervals are considered overlapping

**Constraints**
• 1 ≤ intervals.length ≤ 10⁴
• intervals[i].length == 2
• 0 ≤ start ≤ end ≤ 10⁴`,
    starterCode: {
      javascript: `function merge(intervals) {
  // Your solution here
}

console.log(merge([[1,3],[2,6],[8,10],[15,18]])); // [[1,6],[8,10],[15,18]]
console.log(merge([[1,4],[4,5]]));                // [[1,5]]
console.log(merge([[1,4],[0,4]]));                // [[0,4]]
`,
      python: `def merge(intervals: list[list[int]]) -> list[list[int]]:
    # Your solution here
    pass

print(merge([[1,3],[2,6],[8,10],[15,18]]))  # [[1,6],[8,10],[15,18]]
print(merge([[1,4],[4,5]]))                 # [[1,5]]
print(merge([[1,4],[0,4]]))                 # [[0,4]]
`,
    },
  },

  {
    id: 'three-sum',
    title: '3Sum',
    difficulty: 'medium',
    tags: ['Array', 'Two Pointers', 'Sorting'],
    defaultLanguage: 'javascript',
    description: `Given an integer array \`nums\`, return all triplets \`[nums[i], nums[j], nums[k]]\` such that \`i ≠ j ≠ k\` and \`nums[i] + nums[j] + nums[k] == 0\`.

The solution must not contain duplicate triplets.

**Example 1**
Input:  nums = [-1,0,1,2,-1,-4]
Output: [[-1,-1,2],[-1,0,1]]

**Example 2**
Input:  nums = [0,1,1]
Output: []

**Example 3**
Input:  nums = [0,0,0]
Output: [[0,0,0]]

**Constraints**
• 3 ≤ nums.length ≤ 3000
• −10⁵ ≤ nums[i] ≤ 10⁵`,
    starterCode: {
      javascript: `function threeSum(nums) {
  // Your solution here
}

console.log(threeSum([-1,0,1,2,-1,-4])); // [[-1,-1,2],[-1,0,1]]
console.log(threeSum([0,1,1]));          // []
console.log(threeSum([0,0,0]));          // [[0,0,0]]
`,
      python: `def three_sum(nums: list[int]) -> list[list[int]]:
    # Your solution here
    pass

print(three_sum([-1,0,1,2,-1,-4]))  # [[-1,-1,2],[-1,0,1]]
print(three_sum([0,1,1]))           # []
print(three_sum([0,0,0]))           # [[0,0,0]]
`,
    },
  },

  {
    id: 'binary-search',
    title: 'Binary Search',
    difficulty: 'medium',
    tags: ['Array', 'Binary Search'],
    defaultLanguage: 'javascript',
    description: `Given a sorted array of integers \`nums\` and a target value, return its index. If not found, return \`-1\`.

You must write an algorithm with **O(log n)** runtime complexity.

**Example 1**
Input:  nums = [-1,0,3,5,9,12], target = 9
Output: 4

**Example 2**
Input:  nums = [-1,0,3,5,9,12], target = 2
Output: -1

**Follow-up**
Can you also implement:
• \`searchInsertPosition\` — index where target would be inserted
• \`searchRange\` — first and last position of target

**Constraints**
• 1 ≤ nums.length ≤ 10⁴
• All values in nums are unique
• nums is sorted in ascending order`,
    starterCode: {
      javascript: `function search(nums, target) {
  // Your solution here
}

console.log(search([-1,0,3,5,9,12], 9));  // 4
console.log(search([-1,0,3,5,9,12], 2));  // -1
console.log(search([5], 5));              // 0
`,
      python: `def search(nums: list[int], target: int) -> int:
    # Your solution here
    pass

print(search([-1,0,3,5,9,12], 9))   # 4
print(search([-1,0,3,5,9,12], 2))   # -1
print(search([5], 5))               # 0
`,
    },
  },

  // ── Hard ───────────────────────────────────────────────────────────────────
  {
    id: 'trapping-rain-water',
    title: 'Trapping Rain Water',
    difficulty: 'hard',
    tags: ['Array', 'Two Pointers', 'Stack'],
    defaultLanguage: 'javascript',
    description: `Given \`n\` non-negative integers representing an elevation map where the width of each bar is 1, compute how much water it can trap after raining.

**Example 1**
Input:  height = [0,1,0,2,1,0,1,3,2,1,2,1]
Output: 6

**Example 2**
Input:  height = [4,2,0,3,2,5]
Output: 9

**Approaches to discuss:**
1. Brute force O(n²)
2. Dynamic programming with prefix/suffix max arrays O(n)
3. Two-pointer O(n) O(1) space

**Constraints**
• n == height.length
• 1 ≤ n ≤ 2 × 10⁴
• 0 ≤ height[i] ≤ 10⁵`,
    starterCode: {
      javascript: `function trap(height) {
  // Your solution here
}

console.log(trap([0,1,0,2,1,0,1,3,2,1,2,1])); // 6
console.log(trap([4,2,0,3,2,5]));              // 9
console.log(trap([1,0,1]));                    // 1
`,
      python: `def trap(height: list[int]) -> int:
    # Your solution here
    pass

print(trap([0,1,0,2,1,0,1,3,2,1,2,1]))  # 6
print(trap([4,2,0,3,2,5]))               # 9
print(trap([1,0,1]))                     # 1
`,
    },
  },

  {
    id: 'lru-cache',
    title: 'LRU Cache',
    difficulty: 'hard',
    tags: ['Design', 'Hash Map', 'Linked List'],
    defaultLanguage: 'javascript',
    description: `Design a data structure that follows the **Least Recently Used (LRU)** cache policy.

Implement the \`LRUCache\` class:
• \`LRUCache(capacity)\` — initialize with positive capacity
• \`get(key)\` — return value if key exists, else return \`-1\`
• \`put(key, value)\` — insert/update. If over capacity, evict the least recently used key.

Both operations must run in **O(1)** average time.

**Example**
\`\`\`
cache = LRUCache(2)
cache.put(1, 1)   // cache: {1=1}
cache.put(2, 2)   // cache: {1=1, 2=2}
cache.get(1)      // returns 1, cache: {2=2, 1=1}
cache.put(3, 3)   // evicts key 2, cache: {1=1, 3=3}
cache.get(2)      // returns -1 (not found)
cache.put(4, 4)   // evicts key 1, cache: {3=3, 4=4}
cache.get(1)      // returns -1
cache.get(3)      // returns 3
cache.get(4)      // returns 4
\`\`\`

**Hint:** Combine a HashMap with a doubly-linked list.`,
    starterCode: {
      javascript: `class LRUCache {
  constructor(capacity) {
    // Your implementation here
  }

  get(key) {
    // Return value or -1
  }

  put(key, value) {
    // Insert or update
  }
}

const cache = new LRUCache(2);
cache.put(1, 1);
cache.put(2, 2);
console.log(cache.get(1));  // 1
cache.put(3, 3);            // evicts key 2
console.log(cache.get(2));  // -1
cache.put(4, 4);            // evicts key 1
console.log(cache.get(1));  // -1
console.log(cache.get(3));  // 3
console.log(cache.get(4));  // 4
`,
      python: `class LRUCache:
    def __init__(self, capacity: int):
        # Your implementation here
        pass

    def get(self, key: int) -> int:
        # Return value or -1
        pass

    def put(self, key: int, value: int) -> None:
        # Insert or update
        pass

cache = LRUCache(2)
cache.put(1, 1)
cache.put(2, 2)
print(cache.get(1))   # 1
cache.put(3, 3)       # evicts key 2
print(cache.get(2))   # -1
cache.put(4, 4)       # evicts key 1
print(cache.get(1))   # -1
print(cache.get(3))   # 3
print(cache.get(4))   # 4
`,
    },
  },

  {
    id: 'word-break',
    title: 'Word Break',
    difficulty: 'hard',
    tags: ['Dynamic Programming', 'String', 'Hash Set'],
    defaultLanguage: 'javascript',
    description: `Given a string \`s\` and a dictionary \`wordDict\`, return \`true\` if \`s\` can be segmented into a space-separated sequence of dictionary words.

Words in the dictionary may be reused multiple times.

**Example 1**
Input:  s = "leetcode", wordDict = ["leet","code"]
Output: true   ("leet" + "code")

**Example 2**
Input:  s = "applepenapple", wordDict = ["apple","pen"]
Output: true   ("apple" + "pen" + "apple")

**Example 3**
Input:  s = "catsandog", wordDict = ["cats","dog","sand","and","cat"]
Output: false

**Follow-up:** Return all possible segmentations (Word Break II).

**Constraints**
• 1 ≤ s.length ≤ 300
• 1 ≤ wordDict.length ≤ 1000`,
    starterCode: {
      javascript: `function wordBreak(s, wordDict) {
  // Your solution here
}

console.log(wordBreak("leetcode", ["leet","code"]));                   // true
console.log(wordBreak("applepenapple", ["apple","pen"]));             // true
console.log(wordBreak("catsandog", ["cats","dog","sand","and","cat"])); // false
`,
      python: `def word_break(s: str, word_dict: list[str]) -> bool:
    # Your solution here
    pass

print(word_break("leetcode", ["leet","code"]))                    # True
print(word_break("applepenapple", ["apple","pen"]))               # True
print(word_break("catsandog", ["cats","dog","sand","and","cat"])) # False
`,
    },
  },
];
