import React from "react";
import { Linking } from "react-native";

import { Text } from "~/components/ui/text";
import { cn } from "~/lib/utils";

// Types for TipTap JSON content
interface Mark {
  type: string;
  attrs?: { href?: string; [key: string]: unknown };
}

interface TextBlock {
  type: string;
  text?: string;
  marks?: Mark[];
}

interface ContentBlock {
  type: string;
  text?: string;
  content?: TextBlock[];
}

interface ContentJSON {
  type: string;
  content: ContentBlock[];
}

// Custom component to render different content types
const RenderContent = (props: { content: string }) => {
  const { content } = props;

  if (!content) return null;

  let contentJSON: ContentJSON;

  try {
    contentJSON = JSON.parse(content) as ContentJSON;
  } catch {
    // Handle plain text content
    contentJSON = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: content,
            },
          ],
        },
      ],
    };
  }

  return contentJSON.content.map((block: ContentBlock, index: number) => {
    switch (block.type) {
      case "heading":
        return (
          <Text key={index} className="py-2 text-lg font-semibold">
            {block.content?.map((textBlock: TextBlock, idx: number) => (
              <Text key={idx}>{textBlock.text}</Text>
            ))}
          </Text>
        );
      case "paragraph":
        return (
          <Text key={index} className="py-1">
            {block.content?.map((textBlock: TextBlock, idx: number) => {
              const hasLink = textBlock.marks?.some(
                (mark: Mark) => mark.type === "link",
              );
              return (
                <Text
                  key={idx}
                  className={cn(
                    "text-foreground",
                    hasLink ? "text-blue" : "text-foreground",
                  )}
                  onPress={
                    hasLink
                      ? () => {
                          const link = textBlock.marks?.find(
                            (mark: Mark) => mark.type === "link",
                          );
                          if (link?.attrs?.href) {
                            Linking.openURL(link.attrs.href);
                          }
                        }
                      : undefined
                  }
                >
                  {textBlock.text}
                </Text>
              );
            })}
          </Text>
        );
      case "text":
        return <Text key={index}>{block.text}</Text>;
      // Add more cases for other types (e.g., codeBlock, orderedList, image)
      default:
        return null;
    }
  });
};

export { RenderContent };
